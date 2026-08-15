import { useState } from 'react';
import Field from './ui/Field';
import './ParsedPreview.css';

const HP_TO_WATT = 746;
const AMP_TO_WATT = 240;

// Matches the `source` field the backend now sets on every appliance.
// Drives the small badge shown next to the category tag — this is the
// difference between "trust this" and "check this before submitting".
const SOURCE_LABEL = {
  exact: { text: 'Stated', tone: 'high' },
  amp: { text: 'Amp × 240', tone: 'high' },
  hp: { text: 'HP × 746', tone: 'high' },
  catalog: { text: 'Catalog default', tone: 'low' },
  llm: { text: 'Estimated', tone: 'low' },
  needs_input: { text: 'Needs input', tone: 'needs_input' },
};

let parsedIdSeed = 0;

/**
 * Shared staging preview shown after the Text / Voice / PDF parse step.
 * Displays each parsed appliance with its matched category badge, a source/
 * confidence badge, editable wattage/horsepower/amperage and quantity, an
 * outlier warning when the stated wattage is unusual for that appliance
 * type, and — for genuinely ambiguous lines (e.g. "2ph") — a two-choice
 * confirmation instead of any input at all, since neither reading should be
 * picked silently.
 *
 * "Add to list" merges the confirmed rows into the main appliances[] state;
 * the parent then switches to Manual. Ambiguous rows can't be added until
 * resolved — they're excluded from selectedRows until a choice is made.
 *
 * Props:
 *  - parsed:   array of parsed-appliance objects from the backend
 *  - onConfirm:(rows: Array) => void  — called with the confirmed rows
 *  - onCancel: () => void
 */
export default function ParsedPreview({ parsed, onConfirm, onCancel }) {
  const [rows, setRows] = useState(() =>
    parsed.map((a) => ({
      selected: !a.ambiguous,
      resolved: !a.ambiguous,
      name: a.name,
      category: a.category,
      multiplier: a.multiplier,
      uses_hp: a.uses_hp,
      uses_amp: a.uses_amp,
      matched: a.matched,
      source: a.source,
      flagged_outlier: a.flagged_outlier,
      outlier_note: a.outlier_note,
      ambiguous: a.ambiguous,
      confirm_options: a.confirm_options || [],
      wattage: a.wattage != null ? String(a.wattage) : '',
      horsepower: a.horsepower != null ? String(a.horsepower) : '',
      amperage: a.amperage != null ? String(a.amperage) : '',
      quantity: String(a.quantity || 1),
    })),
  );

  const update = (i, patch) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const onHorsepower = (i, value) => {
    const hp = parseFloat(value) || 0;
    const watts = hp * HP_TO_WATT;
    update(i, { horsepower: value, wattage: hp > 0 ? String(Math.round(watts)) : '' });
  };

  const onAmperage = (i, value) => {
    const amps = parseFloat(value) || 0;
    const watts = amps * AMP_TO_WATT;
    update(i, { amperage: value, wattage: amps > 0 ? String(Math.round(watts)) : '' });
  };

  // Resolving an ambiguous row commits one of its confirm_options and turns
  // it into a normal, editable row — same shape as everything else from here.
  const resolveAmbiguous = (i, option) => {
    update(i, {
      ambiguous: false,
      resolved: true,
      selected: true,
      source: option.choice === 'hp' ? 'hp' : (option.watts != null ? option.source || 'exact' : 'needs_input'),
      horsepower: option.choice === 'hp' ? String(option.watts / HP_TO_WATT) : '',
      wattage: option.watts != null ? String(option.watts) : '',
      uses_hp: option.choice === 'hp',
    });
  };

  const selectedRows = rows
    .filter((r) => r.selected && r.resolved)
    .map((r) => ({
      id: ++parsedIdSeed,
      applianceName: r.name,
      selectedAppliance: {
        name: r.name,
        category: r.category,
        multiplier: r.multiplier,
        usesHp: r.uses_hp,
      },
      wattage: r.wattage,
      horsepower: r.horsepower,
      quantity: Math.max(1, parseInt(r.quantity) || 1),
    }));

  const pendingCount = rows.filter((r) => r.ambiguous).length;

  return (
    <div className="parsed-preview">
      <div className="parsed-preview-header">
        <span className="step-eyebrow">Confirm appliances</span>
        <p className="step-description">
          Review the detected appliances, adjust wattage or quantity, then add them to your load list.
          {pendingCount > 0 && (
            <span className="pending-note"> {pendingCount} item{pendingCount > 1 ? 's' : ''} need your input below before they can be added.</span>
          )}
        </p>
      </div>

      <div className="parsed-list">
        {rows.map((r, i) => {
          if (r.ambiguous) {
            return (
              <div key={i} className="parsed-row ambiguous">
                <div className="parsed-name">
                  <span className="parsed-appliance-name">{r.name}</span>
                  <span className="ambiguous-tag">⚠ Confirm</span>
                </div>
                <p className="ambiguous-note">
                  The source text used an abbreviation that could mean two different things — pick one:
                </p>
                <div className="confirm-options">
                  {r.confirm_options.map((opt) => (
                    <button
                      key={opt.choice}
                      type="button"
                      className="confirm-chip"
                      onClick={() => resolveAmbiguous(i, opt)}
                    >
                      <span className="confirm-chip-label">{opt.label}</span>
                      <span className="confirm-chip-watts">
                        {opt.watts != null ? `→ ${opt.watts.toLocaleString()} W` : '→ needs a rating'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          const sourceInfo = SOURCE_LABEL[r.source] || SOURCE_LABEL.llm;

          return (
            <div key={i} className={`parsed-row ${r.selected ? '' : 'dim'}`}>
              <label className="parsed-check">
                <input
                  type="checkbox"
                  checked={r.selected}
                  onChange={(e) => update(i, { selected: e.target.checked })}
                />
              </label>

              <div className="parsed-name">
                <span className="parsed-appliance-name">{r.name}</span>
                <span className={`category-tag ${r.category.toLowerCase()}`}>
                  {r.category} (×{r.multiplier})
                  {r.uses_hp && ' [HP]'}
                </span>
                <span className={`source-tag ${sourceInfo.tone}`}>{sourceInfo.text}</span>
                {!r.matched && <span className="unmatched-tag">not in catalog</span>}
              </div>

              {r.flagged_outlier && (
                <p className="outlier-note">⚠ {r.outlier_note}</p>
              )}

              <div className="parsed-inputs">
                {r.uses_hp ? (
                  <div className="hp-input">
                    <Field
                      type="number"
                      mono
                      value={r.horsepower}
                      onChange={(e) => onHorsepower(i, e.target.value)}
                      placeholder="HP"
                      min="0.5"
                      step="0.5"
                    />
                    <span className="unit-label">HP</span>
                    {r.wattage && parseFloat(r.wattage) > 0 && (
                      <span className="converted-wattage">= {parseFloat(r.wattage).toLocaleString()} W</span>
                    )}
                  </div>
                ) : r.uses_amp ? (
                  <div className="amp-input">
                    <Field
                      type="number"
                      mono
                      value={r.amperage}
                      onChange={(e) => onAmperage(i, e.target.value)}
                      placeholder="A"
                      min="0.1"
                      step="0.1"
                    />
                    <span className="unit-label">A</span>
                    {r.wattage && parseFloat(r.wattage) > 0 && (
                      <span className="converted-wattage">= {parseFloat(r.wattage).toLocaleString()} W</span>
                    )}
                  </div>
                ) : (
                  <div className="w-input">
                    <Field
                      type="number"
                      mono
                      value={r.wattage}
                      onChange={(e) => update(i, { wattage: e.target.value })}
                      placeholder="W"
                      min="1"
                    />
                    <span className="unit-label">W</span>
                  </div>
                )}
                <div className="qty-input">
                  <Field
                    type="number"
                    mono
                    value={r.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    min="1"
                  />
                  <span className="unit-label">×</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="parsed-actions">
        <button type="button" className="btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-submit"
          disabled={selectedRows.length === 0}
          onClick={() => onConfirm(selectedRows)}
        >
          Add {selectedRows.length > 0 ? `${selectedRows.length} ` : ''}to load list
        </button>
      </div>
    </div>
  );
}
