import { useState, useRef, useMemo } from 'react';
import Field from './ui/Field';

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

// Inverter tiers for load meter - extended to 50kVA with system voltage
// Voltage based on standard inverter sizing chart
const TIERS = [
  { kva: 1, watts: 800, voltage: '12V' },
  { kva: 2, watts: 1600, voltage: '24V' },
  { kva: 3.5, watts: 2800, voltage: '24V' },
  { kva: 5, watts: 4000, voltage: '48V' },
  { kva: 7.5, watts: 6000, voltage: '96V' },
  { kva: 10, watts: 8000, voltage: '120V' },
  { kva: 15, watts: 12000, voltage: '180V / 240V' },
  { kva: 20, watts: 16000, voltage: '360V' },
  { kva: 25, watts: 20000, voltage: '360V' },
  { kva: 30, watts: 24000, voltage: '360V' },
  { kva: 40, watts: 32000, voltage: '360V' },
  { kva: 50, watts: 40000, voltage: '360V' },
];

const TOTAL_SEGMENTS = 20;

const Step1Load = ({ data, onChange, onNext }) => {
  const [appliances, setAppliances] = useState(
    data.appliances && data.appliances.length > 0
      ? data.appliances
      : [{ id: 1, applianceName: '', wattage: '', horsepower: '', quantity: 1, selectedAppliance: null }]
  );

  const [showSuggestions, setShowSuggestions] = useState({});
  const [analyzingIndex, setAnalyzingIndex] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

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

  // Load meter calculations
  const recommendedTier = useMemo(() => {
    return TIERS.find((t) => total <= t.watts) || TIERS[TIERS.length - 1];
  }, [total]);

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

  const litSegments = useMemo(() => {
    const maxWatts = TIERS[TIERS.length - 1].watts;
    const ratio = Math.min(total / maxWatts, 1);
    return Math.round(ratio * TOTAL_SEGMENTS);
  }, [total]);

  const isOverCapacity = total > TIERS[TIERS.length - 1].watts;

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
            {Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => (
              <div
                key={i}
                className={`gauge-segment ${i < litSegments ? 'lit' : ''}`}
                style={{
                  background: i < litSegments ? (isOverCapacity ? '#ef4444' : 'var(--color-green)') : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>

          <div className="tier-labels">
            {TIERS.map((t) => (
              <span
                key={t.kva}
                className={recommendedTier.kva === t.kva ? 'active' : ''}
              >
                {t.kva}kVA ({t.voltage})
              </span>
            ))}
          </div>

          <div className="load-meter-footer">
            <span className="recommended-inverter">
              Recommended Inverter: <strong>{recommendedTier.kva} kVA</strong> | System Voltage: <strong>{recommendedTier.voltage}</strong>
            </span>
            {isOverCapacity && (
              <span className="over-capacity-warning">Exceeds 50kVA - Custom setup required</span>
            )}
          </div>
        </div>
      )}

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
