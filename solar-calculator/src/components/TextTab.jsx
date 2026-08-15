import { useState } from 'react';
import { parseAppliances } from '../lib/applianceApi';
import './TextTab.css';

/**
 * Text input tab: user types a free-text appliance list, clicks "Parse
 * Appliances", and the backend LLM returns structured rows that the shared
 * ParsedPreview confirms before merging.
 *
 * Props:
 *  - onParsed: (rows) => void  — parent shows ParsedPreview with these rows
 *  - busy:     boolean         — shared busy flag (disabled while any parse runs)
 */
export default function TextTab({ onParsed, busy }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleParse = async () => {
    if (!text.trim() || loading || busy) return;
    setLoading(true);
    setError('');
    try {
      const rows = await parseAppliances(text);
      if (rows.length === 0) {
        setError('No appliances were detected. Try rephrasing your list.');
      } else {
        onParsed(rows);
      }
    } catch (e) {
      setError(e.message || 'Could not parse text. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-tab">
      <textarea
        className="field mono text-area"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Refrigerator - 200W - Qty 1\nCeiling Fan - 75W - Qty 3\nAir Conditioner - 1.5HP - Qty 1'}
      />
      <p className="text-hint">
        One appliance per line. Include wattage (W) or horsepower (HP) and quantity
        where you know it — the AI estimates anything you leave out, and you'll
        confirm the parsed list before it's added.
      </p>
      {error && <p className="tab-error">{error}</p>}
      <div className="tab-actions">
        <button
          type="button"
          className="btn-tab-action"
          disabled={!text.trim() || loading || busy}
          onClick={handleParse}
        >
          {loading ? 'Parsing…' : 'Parse Appliances'}
        </button>
      </div>
    </div>
  );
}
