import { useState, useRef, useEffect } from 'react';
import { transcribeAudio, parseAppliances } from '../lib/applianceApi';
import './VoiceTab.css';

/**
 * Voice input tab: the user records themselves listing appliances. The audio
 * is sent to the backend's Groq Whisper endpoint for transcription, then the
 * transcript is parsed by the same LLM used by the Text tab. The shared
 * ParsedPreview confirms the result before merging.
 *
 * Props:
 *  - onParsed: (rows) => void
 *  - busy:     boolean
 */
export default function VoiceTab({ onParsed, busy }) {
  const [supported] = useState(
    () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)
  );
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(''); // '' | 'transcribing' | 'parsing'
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const stopStream = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  const startRecording = async () => {
    setError('');
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError('Microphone access denied or unavailable. Please allow mic access and try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    stopStream();
  };

  const handleStop = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size === 0) {
      setError('Recording was empty. Please try again.');
      return;
    }
    setLoading('transcribing');
    setError('');
    try {
      const text = await transcribeAudio(blob);
      setTranscript(text);
      if (!text.trim()) {
        setError('No speech was detected in the recording.');
      }
    } catch (e) {
      setError(e.message || 'Could not transcribe audio. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const handleParse = async () => {
    if (!transcript.trim() || loading) return;
    setLoading('parsing');
    setError('');
    try {
      const rows = await parseAppliances(transcript);
      if (rows.length === 0) {
        setError('No appliances were detected in the transcript.');
      } else {
        onParsed(rows);
      }
    } catch (e) {
      setError(e.message || 'Could not parse appliances. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!supported) {
    return (
      <div className="voice-tab">
        <div className="voice-panel">
          <p className="tab-error">
            Voice recording isn't supported in this browser. Try Chrome or Edge, or
            use the Text / PDF / Manual tabs instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-tab">
      <div className="voice-panel">
        <button
          type="button"
          className={`mic-btn ${recording ? 'rec' : ''}`}
          onClick={recording ? stopRecording : startRecording}
          disabled={!!loading || busy}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4" />
          </svg>
        </button>
        <div className="voice-state">
          {recording ? (
            <><span className="rec">● Recording</span> — {fmt(elapsed)}</>
          ) : loading === 'transcribing' ? (
            <span className="rec">Transcribing…</span>
          ) : loading === 'parsing' ? (
            <span className="rec">Parsing appliances…</span>
          ) : (
            'Tap the mic and list your appliances'
          )}
        </div>

        {transcript && (
          <div className="transcript">{transcript}</div>
        )}

        {error && <p className="tab-error">{error}</p>}

        <div className="voice-actions">
          {transcript && !loading && (
            <>
              <button
                type="button"
                className="btn-outline"
                onClick={() => { setTranscript(''); setError(''); }}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn-submit"
                disabled={!!loading || busy}
                onClick={handleParse}
              >
                Parse Appliances
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
