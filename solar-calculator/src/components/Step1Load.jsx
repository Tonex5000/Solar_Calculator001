import { useState, useRef, useMemo } from 'react';
import Field from './ui/Field';
import TextTab from './TextTab';
import VoiceTab from './VoiceTab';
import PdfTab from './PdfTab';
import ParsedPreview from './ParsedPreview';

// Appliance data from PDF with categorized load types
// Rules: "Nonlinear + Resistive" = Resistive, "Resistive + Inductive" = Inductive, "Inductive + Nonlinear" = Inductive
const APPLIANCES_DATA = [
  // Inductive loads (Heavy motors) - Multiplier: 3
  { name: 'Air Conditioner', category: 'Inductive', multiplier: 3, wattage: '500 - 3,500 W', usesHp: true },
  { name: 'Refrigerator', category: 'Inductive', multiplier: 3, wattage: '100 - 800 W' },
  { name: 'Washing Machine', category: 'Inductive', multiplier: 3, wattage: '400 - 1,400 W' },
  { name: 'Ceiling Fan', category: 'Inductive', multiplier: 3, wattage: '50 - 100 W' },
  { name: 'Exhaust Fan', category: 'Inductive', multiplier: 3, wattage: '50 - 100 W' },
  { name: 'Vacuum Cleaner', category: 'Inductive', multiplier: 3, wattage: '500 - 1,200 W' },
  { name: 'Dishwasher', category: 'Inductive', multiplier: 3, wattage: '1,200 - 2,400 W' },
  { name: 'Water Pump', category: 'Inductive', multiplier: 3, wattage: '500 - 1,500 W', usesHp: true },
  { name: 'Inverter AC', category: 'Inductive', multiplier: 3, wattage: '500 - 2,500 W', usesHp: true },
  { name: 'Hair Dryer', category: 'Inductive', multiplier: 3, wattage: '1,000 - 1,800 W' },
  // Resistive loads (Heating) - Multiplier: 4
  { name: 'Electric Heater', category: 'Resistive', multiplier: 4, wattage: '1,000 - 2,000 W' },
  { name: 'Electric Kettle', category: 'Resistive', multiplier: 4, wattage: '1,200 - 1,800 W' },
  { name: 'Toaster', category: 'Resistive', multiplier: 4, wattage: '800 - 1,500 W' },
  { name: 'Electric Stove', category: 'Resistive', multiplier: 4, wattage: '2,000 - 5,000 W' },
  { name: 'Electric Oven', category: 'Resistive', multiplier: 4, wattage: '2,000 - 5,000 W' },
  { name: 'Incandescent Bulb', category: 'Resistive', multiplier: 4, wattage: '40 - 100 W' },
  { name: 'Iron (Electric)', category: 'Resistive', multiplier: 4, wattage: '1,000 - 1,800 W' },
  { name: 'Microwave Oven', category: 'Resistive', multiplier: 4, wattage: '600 - 1,200 W' },
  // Nonlinear loads (Electronics) - Multiplier: 1
  { name: 'LED Light', category: 'Nonlinear', multiplier: 1, wattage: '5 - 20 W' },
  { name: 'CFL Light', category: 'Nonlinear', multiplier: 1, wattage: '5 - 20 W' },
  { name: 'LED TV', category: 'Nonlinear', multiplier: 1, wattage: '50 - 200 W' },
  { name: 'Computer', category: 'Nonlinear', multiplier: 1, wattage: '50 - 300 W' },
  { name: 'Laptop', category: 'Nonlinear', multiplier: 1, wattage: '50 - 300 W' },
  { name: 'Phone Charger', category: 'Nonlinear', multiplier: 1, wattage: '5 - 25 W' },
];

// Horsepower to Watt conversion (1 HP = 746 W)
const HP_TO_WATT = 746;

// Inverter tiers for load meter - 1 kVA to 200 kVA with system voltage options.
// `watts` is the derated (x0.8) continuous output; sizing uses kVA*1000 VA.
const TIERS = [
  { kva: 1, watts: 800, voltage: '12V' },
  { kva: 1.5, watts: 1200, voltage: '12V / 24V / 48V' },
  { kva: 2, watts: 1600, voltage: '24V' },
  { kva: 2.5, watts: 2000, voltage: '12V / 24V / 48V' },
  { kva: 3, watts: 2400, voltage: '24V / 48V' },
  { kva: 3.5, watts: 2800, voltage: '24V / 48V' },
  { kva: 4, watts: 3200, voltage: '48V' },
  { kva: 5, watts: 4000, voltage: '48V / 96V' },
  { kva: 6, watts: 4800, voltage: '48V' },
  { kva: 7.5, watts: 6000, voltage: '48V / 120V' },
  { kva: 8, watts: 6400, voltage: '48V / 96V' },
  { kva: 10, watts: 8000, voltage: '48V / 120V / 180V' },
  { kva: 12, watts: 9600, voltage: '48V / 96V / 120V / 180V' },
  { kva: 15, watts: 12000, voltage: '48V / 96V / 120V / 360V' },
  { kva: 18, watts: 14400, voltage: '48V / 96V / 120V / 192V / 240V / 360V' },
  { kva: 20, watts: 16000, voltage: '120V / 192V / 360V' },
  { kva: 25, watts: 20000, voltage: '360V' },
  { kva: 30, watts: 24000, voltage: '192V / 360V' },
  { kva: 40, watts: 32000, voltage: '240V / 360V' },
  { kva: 45, watts: 36000, voltage: '360V' },
  { kva: 50, watts: 40000, voltage: '360V' },
  { kva: 60, watts: 48000, voltage: '360V' },
  { kva: 80, watts: 64000, voltage: '360V' },
  { kva: 100, watts: 80000, voltage: '360V' },
  { kva: 125, watts: 100000, voltage: '360V' },
  { kva: 150, watts: 120000, voltage: '360V' },
  { kva: 180, watts: 144000, voltage: '360V' },
  { kva: 200, watts: 160000, voltage: '360V' },
];

// Subset of tiers shown as tick labels under the gauge. The full TIERS
// table is still used for matching; only the display labels are reduced
// to major reference points so the row stays legible.
const MAJOR_TICKS = new Set([1, 2, 5, 10, 20, 50, 100, 200]);
// Tiers that own a visible segment + label, in ascending order. The
// segmented indicator has one segment per entry here, aligned 1:1 with
// the labels, so the lit fill tracks the tick values underneath it.
const MAJOR_TIERS = TIERS.filter((t) => MAJOR_TICKS.has(t.kva));

const Step1Load = ({ data, onChange, onNext }) => {
  const [appliances, setAppliances] = useState(
    data.appliances && data.appliances.length > 0
      ? data.appliances
      : [{ id: 1, applianceName: '', wattage: '', horsepower: '', quantity: 1, selectedAppliance: null }]
  );

  const [showSuggestions, setShowSuggestions] = useState({});
  const [analyzingIndex, setAnalyzingIndex] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  // Input-method tabs. The shared `appliances` list is the single source of
  // truth for the load meter and Submit, regardless of which tab produced it.
  const [activeMode, setActiveMode] = useState('manual');
  // Parsed rows staged from Text/Voice/PDF, awaiting confirmation.
  const [parsedRows, setParsedRows] = useState(null);

  const fileInputRefs = useRef({});

const analyzeImage = async (index, file) => {
  setAnalyzingIndex(index);
  setAnalysisResult(null);
  const formData = new FormData();
  formData.append('file', file); // must match backend's `file` param name
  try {
    const response = await fetch('https://solar-calculator001-8.onrender.com/analyze-adapter', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to analyze image');
    const result = await response.json();
    setAnalysisResult(result);
    if (result.wattage_value) {
      handleWattageChange(index, result.wattage_value.toString());
    }
  } catch (error) {
    console.error('Analysis error:', error);
    setAnalysisResult({
      wattage: null,
      raw_text: 'Error: Could not analyze image. Please try again or enter wattage manually.',
    });
  } finally {
    setAnalyzingIndex(null);
  }
};

  const handleFileChange = (index, e) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeImage(index, file);
    }
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index].value = '';
    }
  };

  const getFilteredAppliances = (search) => {
    if (!search) return APPLIANCES_DATA;
    return APPLIANCES_DATA.filter((app) =>
      app.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  const handleSearchChange = (index, value) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], applianceName: value, wattage: '', horsepower: '', selectedAppliance: null };
    setAppliances(updated);
    setShowSuggestions((prev) => ({ ...prev, [index]: value.length > 0 }));
  };

  const selectAppliance = (index, appliance) => {
    const updated = [...appliances];
    updated[index] = {
      ...updated[index],
      applianceName: appliance.name,
      selectedAppliance: appliance,
      wattage: '',
      horsepower: '',
    };
    setAppliances(updated);
    setShowSuggestions((prev) => ({ ...prev, [index]: false }));
  };

  const handleWattageChange = (index, value) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], wattage: value };
    setAppliances(updated);
  };

  const handleHorsepowerChange = (index, value) => {
    const updated = [...appliances];
    // Convert HP to watts and store in wattage
    const hp = parseFloat(value) || 0;
    const convertedWattage = hp * HP_TO_WATT;
    updated[index] = { ...updated[index], horsepower: value, wattage: convertedWattage.toString() };
    setAppliances(updated);
  };

  const handleQuantityChange = (index, value) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], quantity: Math.max(1, parseInt(value) || 1) };
    setAppliances(updated);
  };

  const addAppliance = () => {
    setAppliances([
      ...appliances,
      {
        id: Date.now(),
        applianceName: '',
        wattage: '',
        horsepower: '',
        quantity: 1,
        selectedAppliance: null,
      },
    ]);
  };

  // Text / Voice / PDF all funnel through this: the parsed rows are staged for
  // confirmation, then merged into the shared appliances[] list.
  const handleParsed = (rows) => {
    setParsedRows(rows);
  };

  const confirmParsed = (confirmedRows) => {
    // Append confirmed rows, replacing any placeholder empty row so the user
    // isn't left with a blank manual row after an import.
    const base = appliances.filter((a) => a.applianceName || a.wattage);
    setAppliances([...base, ...confirmedRows]);
    setParsedRows(null);
    setActiveMode('manual');
  };

  const cancelParsed = () => setParsedRows(null);

  const removeAppliance = (index) => {
    if (appliances.length > 1) {
      setAppliances(appliances.filter((_, i) => i !== index));
    }
  };

  const calculateTotalLoad = () => {
    let total = 0;
    const applianceDetails = [];

    appliances.forEach((app) => {
      if (app.selectedAppliance && app.wattage && app.quantity) {
        const wattage = parseFloat(app.wattage);
        const quantity = parseInt(app.quantity);
        const multiplier = app.selectedAppliance.multiplier;
        const usesHorsepower = app.selectedAppliance.usesHp;
        const horsepower = app.horsepower ? parseFloat(app.horsepower) : null;
        const calculatedLoad = quantity * wattage * multiplier;

        total += calculatedLoad;
        applianceDetails.push({
          name: app.selectedAppliance.name,
          wattage,
          quantity,
          multiplier,
          calculatedLoad,
          usesHorsepower,
          horsepower,
        });
      }
    });

    return { total, details: applianceDetails };
  };

  const { total } = calculateTotalLoad();

  // Inverter sizing basis: oversize the connected load 2x (surge/headroom)
  // and derate by 0.8 (power factor) -> inverter VA requirement.
  const inverterLoad = (total * 2) / 0.8;

  // Each tier's true capacity is kVA * 1000 VA (the 0.8 power factor is
  // already accounted for in `inverterLoad`, so we match against the
  // clean VA capacity, not the pre-derated `watts` ceiling, to avoid
  // applying 0.8 twice).
  const tierCapacity = (t) => t.kva * 1000;
  const MAX_VA = tierCapacity(TIERS[TIERS.length - 1]);

  // Load meter calculations
  const recommendedTier = useMemo(() => {
    return TIERS.find((t) => inverterLoad <= tierCapacity(t)) || TIERS[TIERS.length - 1];
  }, [inverterLoad]);

  const handleSubmit = () => {
    const { total, details } = calculateTotalLoad();
    // Parse the voltage from the recommended tier (e.g., "12V" -> 12, "180V / 240V" -> 180)
    const switchingVoltStr = recommendedTier.voltage;
    const switchingVolt = parseInt(switchingVoltStr.split('/')[0].replace('V', '').trim());
    
    onChange({
      load: total.toString(),
      switching_volt: switchingVolt,
      appliances: appliances,
      applianceDetails: details,
    });
    onNext();
  };

  // Major tick that should appear active: the recommendation itself if it is
  // a major tick, otherwise the largest major tick at or below it, so the
  // active label tracks the gauge position across intermediate tiers.
  const activeMajorTick = useMemo(() => {
    const exact = MAJOR_TIERS.find((t) => t.kva === recommendedTier.kva);
    if (exact) return exact.kva;
    const below = [...MAJOR_TIERS].reverse().find((t) => t.kva <= recommendedTier.kva);
    return below ? below.kva : MAJOR_TIERS[0].kva;
  }, [recommendedTier]);

  // Segmented indicator: one segment per major tick, aligned 1:1 with the
  // labels below. Light every segment up to and including the active tick,
  // so the fill follows the tick values rather than a linear watt scale.
  const MAX_TICK = MAJOR_TIERS[MAJOR_TIERS.length - 1].kva;
  const litSegments = useMemo(() => {
    return MAJOR_TIERS.findIndex((t) => t.kva === activeMajorTick) + 1;
  }, [activeMajorTick]);

  const isOverCapacity = recommendedTier.kva >= MAX_TICK && inverterLoad > MAX_VA;

  return (
    <div className="step-content">
      <span className="step-eyebrow">STEP 01 / 04</span>
      <h2>LOAD</h2>
      <p className="step-description">Search and select appliances to calculate your power load</p>

      {/* Load Meter */}
      {total > 0 && (
        <div className="load-meter">
          <div className="load-meter-header">
            <span>Total Connected Load</span>
            <span className="watt-display" style={{ color: isOverCapacity ? '#ef4444' : 'var(--color-green)' }}>
              {total.toLocaleString()}
              <span className="watt-unit">W</span>
            </span>
          </div>

          <div className="gauge">
            {MAJOR_TIERS.map((t, i) => (
              <div
                key={t.kva}
                className={`gauge-segment ${i < litSegments ? 'lit' : ''}`}
                style={{
                  background: i < litSegments ? (isOverCapacity ? '#ef4444' : 'var(--color-green)') : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>

          <div className="tier-labels">
            {MAJOR_TIERS.map((t) => (
              <span
                key={t.kva}
                className={t.kva === activeMajorTick ? 'active' : ''}
              >
                {t.kva}kVA
              </span>
            ))}
          </div>

          <div className="load-meter-footer">
            <span className="recommended-inverter">
              Recommended Inverter: <strong>{recommendedTier.kva} kVA</strong> | System Voltage: <strong>{recommendedTier.voltage}</strong>
            </span>
            {isOverCapacity && (
              <span className="over-capacity-warning">Exceeds 200kVA - Custom setup required</span>
            )}
          </div>
        </div>
      )}

      {/* Input-method tabs. The load meter above is mode-agnostic. */}
      <div className="mode-tabs">
        {[
          { id: 'manual', label: 'Manual', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          { id: 'text', label: 'Text', icon: 'M4 6h16M4 12h16M4 18h10' },
          { id: 'pdf', label: 'PDF', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6' },
          { id: 'voice', label: 'Voice', icon: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4', beta: true },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mode-tab ${activeMode === tab.id ? 'active' : ''}`}
            onClick={() => setActiveMode(tab.id)}
            disabled={!!parsedRows}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={tab.icon} />
            </svg>
            {tab.label}
            {tab.beta && <span className="tag">Beta</span>}
          </button>
        ))}
      </div>

      {/* Parsed-appliance confirmation (Text / Voice / PDF). */}
      {parsedRows ? (
        <ParsedPreview
          parsed={parsedRows}
          onConfirm={confirmParsed}
          onCancel={cancelParsed}
        />
      ) : (
        <>
      {/* MANUAL */}
      {activeMode === 'manual' && (
      <>
      {/* Main Appliance Card */}
      <div className="appliance-card">
        {/* Table Header */}
        <div className="appliance-header">
          <div className="header-cell appliance-col">Appliance</div>
          <div className="header-cell wattage-col">Wattage (W)</div>
          <div className="header-cell qty-col">Qty</div>
        </div>

        {appliances.map((app, index) => {
          const usesHorsepower = app.selectedAppliance?.usesHp;
          return (
            <div key={app.id || index} className="appliance-row">
              {/* Appliance Search Column */}
              <div className="appliance-cell appliance-col">
                <div className="search-container">
                  <Field
                    type="text"
                    value={app.applianceName}
                    onChange={(e) => handleSearchChange(index, e.target.value)}
                    onFocus={() => setShowSuggestions((prev) => ({ ...prev, [index]: true }))}
                    onBlur={() => setTimeout(() => setShowSuggestions((prev) => ({ ...prev, [index]: false })), 200)}
                    placeholder="Search appliance..."
                  />

                  {showSuggestions[index] && app.applianceName && (
                    <div className="suggestions-dropdown">
                      {getFilteredAppliances(app.applianceName)
                        .slice(0, 8)
                        .map((suggestion, i) => (
                          <div
                            key={i}
                            className="suggestion-item"
                            onClick={() => selectAppliance(index, suggestion)}
                          >
                            <span className="suggestion-name">{suggestion.name}</span>
                            <span className={`category-tag ${suggestion.category.toLowerCase()}`}>
                              {suggestion.category} (×{suggestion.multiplier})
                              {suggestion.usesHp && ' [HP]'}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Wattage Column with Upload or Horsepower */}
              <div className="appliance-cell wattage-col">
                {usesHorsepower ? (
                  <div className="horsepower-input-container">
                    <Field
                      type="number"
                      mono
                      value={app.horsepower}
                      onChange={(e) => handleHorsepowerChange(index, e.target.value)}
                      placeholder="HP"
                      min="0.5"
                      step="0.5"
                    />
                    <span className="unit-label">HP</span>
                    {app.wattage && parseFloat(app.wattage) > 0 && (
                      <span className="converted-wattage">
                        = {parseFloat(app.wattage).toLocaleString()} W
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <Field
                      type="number"
                      mono
                      value={app.wattage}
                      onChange={(e) => handleWattageChange(index, e.target.value)}
                      placeholder="150"
                      min="1"
                    />

                    <label className={`upload-detect-btn ${analyzingIndex === index ? 'analyzing' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        ref={(el) => (fileInputRefs.current[index] = el)}
                        onChange={(e) => handleFileChange(index, e)}
                        disabled={analyzingIndex === index}
                      />
                      {analyzingIndex === index ? 'Analyzing...' : 'Upload to detect wattage'}
                    </label>

                    {analyzingIndex === index && <span className="analysis-status">Analyzing image...</span>}

                    {analysisResult && analyzingIndex === null && (
                      <span className={`analysis-result ${analysisResult.wattage ? 'success' : 'error'}`}>
                        {analysisResult.wattage
                          ? `✓ Detected: ${analysisResult.wattage}`
                          : `⚠ ${analysisResult.raw_text}`}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Quantity Column */}
              <div className="appliance-cell qty-col">
                <Field
                  type="number"
                  mono
                  value={app.quantity}
                  onChange={(e) => handleQuantityChange(index, e.target.value)}
                  min="1"
                />
              </div>

              {/* Remove Button */}
              {appliances.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeAppliance(index)}
                >
                  ×
                </button>
              )}

              {/* Calculation Preview */}

            </div>
          );
        })}
      </div>

      <button type="button" className="btn-add" onClick={addAppliance}>
        + Add more appliances
      </button>
      </>
      )}

      {/* TEXT */}
      {activeMode === 'text' && (
        <TextTab onParsed={handleParsed} />
      )}

      {/* VOICE */}
      {activeMode === 'voice' && (
        <VoiceTab onParsed={handleParsed} />
      )}

      {/* PDF */}
      {activeMode === 'pdf' && (
        <PdfTab onParsed={handleParsed} />
      )}
        </>
      )}

      <button
        type="button"
        className="btn-submit"
        onClick={handleSubmit}
        disabled={total === 0}
      >
        Submit Load{' — '}<span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{total > 0 ? `${total.toLocaleString()} W` : '0 W'}</span>
      </button>
    </div>
  );
};

export default Step1Load;
