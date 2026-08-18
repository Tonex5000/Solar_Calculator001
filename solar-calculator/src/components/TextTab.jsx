import { useState, useRef, useEffect, useMemo } from 'react';
import Field from './ui/Field';
import { parseAppliances } from '../lib/applianceApi';
import './TextTab.css';

// Mirrors ParsedPreview's deterministic conversions so the chat resolves rows
// to exactly the wattage the staging grid would compute for the same input.
const HP_TO_WATT = 746;
const AMP_TO_WATT = 240;

const SOURCE_TEXT = {
  exact: 'stated',
  amp: 'amp × 240',
  hp: 'hp × 746',
  catalog: 'catalog default',
  llm: 'estimated',
  needs_input: 'needs input',
  ambiguous: 'ambiguous',
};

// A row needs a clarification turn when we can't trust the wattage as-is:
//  - ambiguous: backend surfaced confirm_options (e.g. "2ph" = HP or phase)
//  - needs_input: no number was stated and no catalog default exists
//  - matched=false: not in the catalog — even with a stated wattage, confirm it
//    rather than silently accepting an inferred category/multiplier. Flagged
//    outliers are NOT a trigger: they have a wattage, just a warning.
function needsClarification(a) {
  return a.ambiguous || a.source === 'needs_input' || a.matched === false;
}

function fmtW(n) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  return isNaN(v) ? '—' : `${v.toLocaleString()} W`;
}

function rowWatts(r) {
  const w = parseFloat(r.wattage);
  const q = parseInt(r.quantity) || 1;
  return isNaN(w) ? 0 : w * q;
}

/**
 * Conversational Text input tab.
 *
 * The user types a free-text appliance list (one or many at a time). The text
 * is sent to the existing backend `/parse-text` endpoint via `parseAppliances`,
 * which returns ParsedAppliance[] (catalog-matched, with conversions already
 * applied by the server's `_resolve_appliance`). Rows the backend can't
 * confidently resolve — ambiguous ("2ph"), needs_input (no rating, no default),
 * or unmatched (not in the catalog) — are queued and the chat asks about them
 * ONE AT A TIME, reusing the backend's `confirm_options` for ambiguous rows and
 * the HP/Amp/W input pattern for the rest (mirroring ParsedPreview).
 *
 * No client-side catalog or parsing exists here: the reference prototype's
 * `APPLIANCE_DB`/`parseChunks`/`lookupAppliance` are intentionally NOT ported —
 * the backend catalog and `_resolve_appliance` pipeline are the source of truth.
 *
 * When the queue drains, the resolved rows (still in the backend's
 * ParsedAppliance shape) are handed to `onParsed`, which routes them through
 * the same ParsedPreview → confirmParsed merge path as before. Nothing about
 * that handoff or Step1Load's shared appliances[] meter is changed.
 *
 * Props:
 *  - onParsed: (rows) => void  — parent stages rows in ParsedPreview
 *  - busy:     boolean         — shared busy flag (disabled while any parse runs)
 */
export default function TextTab({ onParsed, busy }) {
  // Chat thread entries: { role:'ai'|'user', text } or a structured
  // { role:'ai', control:{ row } } turn that renders an inline clarification.
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'List the appliances you want to power. Write it however feels natural — e.g. "2 ceiling fans, a fridge, and a TV". I\'ll confirm anything I can\'t confidently match, one at a time.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Resolved rows: a copy of the backend's ParsedAppliance shape with the
  // wattage/horsepower/amperage/source fields updated as the user clarifies.
  // This is the staged set the live subtotal runs over (pre-confirmation).
  const [resolved, setResolved] = useState([]);
  // Queue of rows still awaiting a clarification turn (FIFO, one at a time).
  const [queue, setQueue] = useState([]);

  const scrollRef = useRef(null);

  // Keep the latest resolved/queue available to async callbacks (the parse
  // fetch resolves after closure capture) without re-running effects. Synced
  // in an effect rather than during render (React forbids ref writes in render).
  const resolvedRef = useRef(resolved);
  const queueRef = useRef(queue);
  useEffect(() => { resolvedRef.current = resolved; }, [resolved]);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const subtotal = useMemo(() => resolved.reduce((s, r) => s + rowWatts(r), 0), [resolved]);

  const pushAI = (text) => setMessages((m) => [...m, { role: 'ai', text }]);
  const pushUser = (text) => setMessages((m) => [...m, { role: 'user', text }]);

  // Ask the next queued clarification, or hand off if the queue is empty.
  // Always operates on the values passed in (not stale closure state) so it
  // stays correct across the async parse callback.
  const advance = (nextResolved, nextQueue) => {
    if (nextQueue.length === 0) {
      if (nextResolved.length > 0) {
        const names = nextResolved
          .map((r) => `${r.quantity}× ${r.name} (${fmtW(r.wattage)})`)
          .join(', ');
        pushAI(`That's everything confirmed. Logged: ${names}. Handing the list over for a final review — you can still tweak wattage or quantity there before it's added to your load.`);
        onParsed(nextResolved);
      } else {
        pushAI("I couldn't find any appliances in that. Try something like \"1 fridge, 2 fans\".");
      }
      return;
    }
    setMessages((m) => [...m, { role: 'ai', control: { row: nextQueue[0] } }]);
  };

  // Resolve an ambiguous row via one of its confirm_options (mirrors
  // ParsedPreview.resolveAmbiguous). If the chosen option still yields no
  // wattage (e.g. a "phase supply" choice), the row re-enters the queue as a
  // needs_input prompt instead of being dropped.
  const resolveAmbiguous = (option) => {
    setError('');
    pushUser(option.label);
    const [head, ...rest] = queueRef.current;
    const updated = {
      ...head,
      ambiguous: false,
      source: option.choice === 'hp'
        ? 'hp'
        : (option.watts != null ? (head.source === 'amp' ? 'amp' : 'exact') : 'needs_input'),
      uses_hp: option.choice === 'hp',
      horsepower: option.choice === 'hp' ? String(Number(option.watts) / HP_TO_WATT) : '',
      wattage: option.watts != null ? String(option.watts) : '',
    };
    const stillNeeds = updated.wattage === '' || updated.wattage == null;
    const nextResolved = stillNeeds ? resolvedRef.current : [...resolvedRef.current, updated];
    const nextQueue = stillNeeds ? [updated, ...rest] : rest;
    setResolved(nextResolved);
    setQueue(nextQueue);
    advance(nextResolved, nextQueue);
  };

  // Apply a typed rating to a needs_input / unmatched row. Detects HP/A/W from
  // the text (or falls back to the row's uses_hp/uses_amp flag), converts with
  // the same constants as ParsedPreview, and advances the queue.
  const applyRating = (text) => {
    const num = text.match(/(\d+(?:\.\d+)?)/);
    if (!num) {
      pushAI('I need a number — for example "150" (watts), "1.5hp", or "5a".');
      return;
    }
    const value = parseFloat(num[1]);
    const lower = text.toLowerCase();
    pushUser(text);

    const [head, ...rest] = queueRef.current;
    let wattage;
    let source = 'exact';
    let uses_hp = false;
    let uses_amp = false;
    let horsepower = '';
    let amperage = '';

    if (/hp|horse/.test(lower) || (head.uses_hp && !/amp|watt|w\b/.test(lower))) {
      wattage = Math.round(value * HP_TO_WATT);
      source = 'hp';
      uses_hp = true;
      horsepower = String(value);
    } else if (/amp|a\b/.test(lower) || head.uses_amp) {
      wattage = Math.round(value * AMP_TO_WATT);
      source = 'amp';
      uses_amp = true;
      amperage = String(value);
    } else {
      wattage = Math.round(value);
    }

    const updated = {
      ...head,
      wattage: String(wattage),
      source,
      uses_hp,
      uses_amp,
      horsepower,
      amperage,
      ambiguous: false,
    };
    const nextResolved = [...resolvedRef.current, updated];
    setResolved(nextResolved);
    setQueue(rest);
    advance(nextResolved, rest);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) {
      setError('Type an answer first.');
      return;
    }
    if (loading || busy) return;
    setError('');

    // If a clarification turn is active, the typed text answers THAT row.
    const activeControl = [...messages].reverse().find((m) => m.role === 'ai' && m.control);
    if (activeControl) {
      const row = activeControl.control.row;
      setInput('');
      if (row.ambiguous) {
        // Ambiguous rows use the confirm chips, not free text.
        pushUser(text);
        pushAI('Pick one of the two options above for that line.');
        return;
      }
      applyRating(text);
      return;
    }

    // No active clarification → treat input as a new appliance list to parse.
    pushUser(text);
    setInput('');
    setLoading(true);
    try {
      const rows = await parseAppliances(text);
      if (rows.length === 0) {
        pushAI('No appliances were detected. Try rephrasing your list — e.g. "1 fridge, 2 ceiling fans".');
        return;
      }
      const okay = [];
      const needAsk = [];
      rows.forEach((r) => (needsClarification(r) ? needAsk.push(r) : okay.push(r)));

      const curResolved = resolvedRef.current;
      const nextResolved = [...curResolved, ...okay];
      setResolved(nextResolved);

      if (okay.length > 0) {
        const summary = okay.map((r) => `${r.quantity}× ${r.name} (${fmtW(r.wattage)})`).join(', ');
        pushAI(`Logged: ${summary}.`);
      }

      // parse path only runs when no control is active, which implies the
      // queue was empty; the fresh needAsk rows become the whole queue.
      const nextQueue = [...needAsk];
      setQueue(nextQueue);

      if (needAsk.length > 0) {
        advance(nextResolved, nextQueue);
      } else if (okay.length > 0) {
        const running = nextResolved.reduce((s, r) => s + rowWatts(r), 0);
        pushAI(`Running subtotal: ${fmtW(running)}. Add more, or hit "Done" to hand the list off.`);
      }
    } catch (e) {
      pushAI(e.message || 'Could not parse text. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // "Done" / hand-off shortcut when no clarification is pending.
  const handleDone = () => {
    if (queueRef.current.length > 0) return; // can't finish mid-clarification
    const cur = resolvedRef.current;
    if (cur.length === 0) {
      pushAI('No items logged yet — list a few appliances first.');
      return;
    }
    onParsed(cur);
    pushAI(`Handing the list (${cur.length} item type${cur.length === 1 ? '' : 's'}, ${fmtW(cur.reduce((s, r) => s + rowWatts(r), 0))} subtotal) over for a final review.`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeControl = [...messages].reverse().find((m) => m.role === 'ai' && m.control);

  return (
    <div className="text-tab chat">
      <div className="chat-thread" ref={scrollRef}>
        {messages.map((m, i) => {
          if (m.role === 'user') {
            return (
              <div key={i} className="bubble user">{m.text}</div>
            );
          }
          if (m.control) {
            const row = m.control.row;
            const isActive = m === activeControl;
            return (
              <div key={i} className={`bubble ai control ${isActive ? 'active' : 'done'}`}>
                <span className="chat-text">
                  {row.ambiguous
                    ? `“${row.name}” — the spec was ambiguous. Pick one:`
                    : row.source === 'needs_input'
                      ? `I don't have a rating for “${row.name}”${row.matched === false ? ' (not in my catalog)' : ''}. What's its size? Give watts (e.g. "150"), horsepower ("1.5hp"), or amps ("5a").`
                      : `“${row.name}” isn't in my catalog. Confirm or adjust its rating — it's currently ${fmtW(row.wattage)} (${SOURCE_TEXT[row.source] || 'stated'}). Type a new value or send as-is.`}
                </span>

                {row.flagged_outlier && row.outlier_note && (
                  <span className="outlier-inline">⚠ {row.outlier_note}</span>
                )}

                {isActive && row.ambiguous && row.confirm_options && (
                  <div className="confirm-options">
                    {row.confirm_options.map((opt) => (
                      <button
                        key={opt.choice}
                        type="button"
                        className="confirm-chip"
                        onClick={() => resolveAmbiguous(opt)}
                      >
                        <span className="confirm-chip-label">{opt.label}</span>
                        <span className="confirm-chip-watts">
                          {opt.watts != null ? `→ ${Number(opt.watts).toLocaleString()} W` : '→ needs a rating'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {isActive && !row.ambiguous && row.source === 'needs_input' && (
                  <div className="clarify-input">
                    {row.uses_hp ? (
                      <div className="hp-input">
                        <Field type="number" mono placeholder="HP" min="0.5" step="0.5"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyRating(e.target.value))} />
                        <span className="unit-label">HP</span>
                      </div>
                    ) : row.uses_amp ? (
                      <div className="amp-input">
                        <Field type="number" mono placeholder="A" min="0.1" step="0.1"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyRating(e.target.value))} />
                        <span className="unit-label">A</span>
                      </div>
                    ) : (
                      <div className="w-input">
                        <Field type="number" mono placeholder="W" min="1"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyRating(e.target.value))} />
                        <span className="unit-label">W</span>
                      </div>
                    )}
                    <button type="button" className="btn-tab-action"
                      onClick={() => {
                        const f = document.querySelector('.clarify-input .field');
                        applyRating(f ? f.value : '');
                      }}>
                      Set rating
                    </button>
                  </div>
                )}

                {isActive && !row.ambiguous && row.source !== 'needs_input' && (
                  <div className="clarify-input">
                    {row.uses_hp ? (
                      <div className="hp-input">
                        <Field type="number" mono placeholder={row.horsepower || 'HP'} min="0.5" step="0.5"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyRating(e.target.value))} />
                        <span className="unit-label">HP</span>
                      </div>
                    ) : row.uses_amp ? (
                      <div className="amp-input">
                        <Field type="number" mono placeholder={row.amperage || 'A'} min="0.1" step="0.1"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyRating(e.target.value))} />
                        <span className="unit-label">A</span>
                      </div>
                    ) : (
                      <div className="w-input">
                        <Field type="number" mono placeholder={row.wattage || 'W'} min="1"
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyRating(e.target.value))} />
                        <span className="unit-label">W</span>
                      </div>
                    )}
                    <button type="button" className="btn-tab-action"
                      onClick={() => {
                        const f = document.querySelector('.clarify-input .field');
                        applyRating(f ? f.value : '');
                      }}>
                      Confirm
                    </button>
                  </div>
                )}

                {!isActive && (
                  <span className="resolved-tag">resolved</span>
                )}
              </div>
            );
          }
          return (
            <div key={i} className="bubble ai">{m.text}</div>
          );
        })}
      </div>

      {/* Live subtotal over staged (not-yet-confirmed) rows. Separate from
          Step1Load's shared appliances[] meter — that one is untouched. */}
      <div className="subtotal-bar">
        <span className="subtotal-label">Staged subtotal</span>
        <span className="subtotal-value">
          {subtotal.toLocaleString()}
          <span className="watt-unit">W</span>
        </span>
        <span className="subtotal-count">
          {resolved.length} item{resolved.length === 1 ? '' : 's'}
          {queue.length > 0 && ` · ${queue.length} to confirm`}
        </span>
      </div>

      {error && <p className="tab-error">{error}</p>}

      <div className="chat-input">
        <textarea
          className="field mono chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={activeControl ? 'Type your answer…' : 'List appliances, or add more…'}
          disabled={!!loading || busy}
        />
        <div className="chat-actions">
          {queue.length === 0 && resolved.length > 0 && (
            <button type="button" className="btn-outline" onClick={handleDone} disabled={!!loading || busy}>
              Done
            </button>
          )}
          <button
            type="button"
            className="btn-tab-action"
            onClick={handleSend}
            disabled={!input.trim() || !!loading || busy}
          >
            {loading ? 'Parsing…' : activeControl ? 'Answer' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
