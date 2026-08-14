import { useState } from 'react';
import Field from './ui/Field';
import './ParsedPreview.css';

const HP_TO_WATT = 746;

let parsedIdSeed = 0;

/**
 * Shared staging preview shown after the Text / Voice / PDF parse step.
 * Displays each parsed appliance with its matched category badge, editable
 * wattage (or horsepower) and quantity. "Add to list" merges the confirmed
 * rows into the main appliances[] state; the parent then switches to Manual.
 *
 * Props:
 *  - parsed:   array of parsed-appliance objects from the backend
 *  - onConfirm:(rows: Array) => void  — called with the confirmed rows
 *  - onCancel: () => void
 */
export default function ParsedPreview({ parsed, onConfirm, onCancel }) {
  // Local editable copy keyed by index. Use a non-Date seed so the React
  // Compiler's "impure function during render" check stays happy.
  const [rows, setRows] = useState(() =>
    parsed.map((a) => ({
      selected: true,
      name: a.name,
      category: a.category,
      multiplier: a.multiplier,
      uses_hp: a.uses_hp,
      matched: a.matched,
      wattage: a.wattage != null ? String(a.wattage) : '',
      horsepower: a.horsepower != null ? String(a.horsepower) : '',
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

  const selectedRows = rows
    .filter((r) => r.selected)
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

  return (
    <div className="parsed-preview">
      <div className="parsed-preview-header">
        <span className="step-eyebrow">Confirm appliances</span>
        <p className="step-description">
          Review the detected appliances, adjust wattage or quantity, then add them to your load list.
        </p>
      </div>

      <div className="parsed-list">
        {rows.map((r, i) => (
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
              {!r.matched && <span className="unmatched-tag">not in catalog</span>}
            </div>

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
        ))}
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
