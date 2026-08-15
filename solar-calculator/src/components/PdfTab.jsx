import { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { parseAppliances } from '../lib/applianceApi';
import './PdfTab.css';

// Configure the worker from the bundled URL (Vite resolves ?url imports).
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * PDF input tab: a text-based PDF (appliance list / BOQ / spec sheet) is read
 * entirely client-side with pdfjs-dist. The extracted text is sent to the same
 * backend LLM parse endpoint as the Text tab, then confirmed via the shared
 * ParsedPreview before merging.
 *
 * Props:
 *  - onParsed: (rows) => void
 *  - busy:     boolean
 */
export default function PdfTab({ onParsed, busy }) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const fmtSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const extractText = async (file) => {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(' ') + '\n';
    }
    return text;
  };

  const handleFile = (file) => {
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File exceeds the 10MB limit.');
      return;
    }
    fileRef.current = file;
    setFileName(file.name);
    setFileSize(fmtSize(file.size));
  };

  const onInputChange = (e) => {
    handleFile(e.target.files?.[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    fileRef.current = null;
    setFileName('');
    setFileSize('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleExtract = async () => {
    const file = fileRef.current;
    if (!file || loading || busy) return;
    setLoading(true);
    setError('');
    try {
      const text = await extractText(file);
      if (!text.trim()) {
        setError('No text could be extracted. The PDF may be a scanned image.');
        return;
      }
      const rows = await parseAppliances(text);
      if (rows.length === 0) {
        setError('No appliances were detected in the PDF.');
      } else {
        onParsed(rows);
      }
    } catch (e) {
      setError(e.message || 'Could not read the PDF. Please try another file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pdf-tab">
      <div
        className="dropzone"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor">
          <path d="M12 3v12m0-12l-4 4m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        <div className="dz-title">Drop PDF here or click to browse</div>
        <div className="dz-sub">Appliance lists, BOQs, or installer spec sheets — max 10MB</div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onInputChange}
          hidden
        />
      </div>

      {fileName && (
        <div className="file-chip">
          <span className="name">
            <span className="dot" />
            {fileName} · {fileSize}
          </span>
          <button type="button" onClick={clearFile} aria-label="Remove file">✕</button>
        </div>
      )}

      {error && <p className="tab-error">{error}</p>}

      <div className="tab-actions">
        <button
          type="button"
          className="upload-detect-btn"
          disabled={!fileName || loading || busy}
          onClick={handleExtract}
        >
          {loading ? 'Extracting…' : 'Extract Appliances'}
        </button>
      </div>
    </div>
  );
}
