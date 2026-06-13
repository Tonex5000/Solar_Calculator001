import { useState, useRef } from 'react';

// Appliance data from PDF with categorized load types
// Rules: "Nonlinear + Resistive" = Resistive, "Resistive + Inductive" = Inductive, "Inductive + Nonlinear" = Inductive

const APPLIANCES_DATA = [
  // Inductive loads (Heavy motors) - Multiplier: 3
  { name: 'Air Conditioner', category: 'Inductive', multiplier: 3, wattage: '500 - 3,500 W' },
  { name: 'Refrigerator', category: 'Inductive', multiplier: 3, wattage: '100 - 800 W' },
  { name: 'Washing Machine', category: 'Inductive', multiplier: 3, wattage: '400 - 1,400 W' },
  { name: 'Ceiling Fan', category: 'Inductive', multiplier: 3, wattage: '50 - 100 W' },
  { name: 'Exhaust Fan', category: 'Inductive', multiplier: 3, wattage: '50 - 100 W' },
  { name: 'Vacuum Cleaner', category: 'Inductive', multiplier: 3, wattage: '500 - 1,200 W' },
  { name: 'Dishwasher', category: 'Inductive', multiplier: 3, wattage: '1,200 - 2,400 W' },
  { name: 'Water Pump', category: 'Inductive', multiplier: 3, wattage: '500 - 1,500 W' },
  { name: 'Inverter AC', category: 'Inductive', multiplier: 3, wattage: '500 - 2,500 W' },
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

const Step1Load = ({ data, onChange, onNext }) => {
  const [appliances, setAppliances] = useState(data.appliances && data.appliances.length > 0 
    ? data.appliances 
    : [{ id: 1, applianceName: '', wattage: '', quantity: 1, selectedAppliance: null }]
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState({});
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);
  const [analyzingIndex, setAnalyzingIndex] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const fileInputRefs = useRef({});

  // Analyze image using AI
  const analyzeImage = async (index, file) => {
    setAnalyzingIndex(index);
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:3001/api/analyze-image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      const result = await response.json();
      setAnalysisResult(result);

      // Auto-fill wattage if found
      if (result.wattage) {
        handleWattageChange(index, result.wattage.toString());
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisResult({
        wattage: null,
        confidence: null,
        raw_text: 'Error: Could not analyze image. Please try again or enter wattage manually.',
        calculation: 'Connection error'
      });
    } finally {
      setAnalyzingIndex(null);
    }
  };

  // Handle file selection
  const handleFileChange = (index, e) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeImage(index, file);
    }
    // Reset input
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index].value = '';
    }
  };

  // Filter appliances based on search term
  const getFilteredAppliances = (search) => {
    if (!search) return APPLIANCES_DATA;
    return APPLIANCES_DATA.filter(app => 
      app.name.toLowerCase().includes(search.toLowerCase())
    );
  };

  // Handle search input change
  const handleSearchChange = (index, value) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], applianceName: value, wattage: '', selectedAppliance: null };
    setAppliances(updated);
    setSearchTerm(value);
    setShowSuggestions(prev => ({ ...prev, [index]: value.length > 0 }));
    setActiveSearchIndex(index);
  };

  // Select an appliance from suggestions
  const selectAppliance = (index, appliance) => {
    const updated = [...appliances];
    updated[index] = { 
      ...updated[index], 
      applianceName: appliance.name, 
      selectedAppliance: appliance,
      wattage: ''
    };
    setAppliances(updated);
    setShowSuggestions(prev => ({ ...prev, [index]: false }));
    setSearchTerm('');
    setActiveSearchIndex(null);
  };

  // Handle wattage change
  const handleWattageChange = (index, value) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], wattage: value };
    setAppliances(updated);
  };

  // Handle quantity change
  const handleQuantityChange = (index, value) => {
    const updated = [...appliances];
    updated[index] = { ...updated[index], quantity: Math.max(1, parseInt(value) || 1) };
    setAppliances(updated);
  };

  // Add new appliance row
  const addAppliance = () => {
    setAppliances([...appliances, { 
      id: Date.now(), 
      applianceName: '', 
      wattage: '', 
      quantity: 1, 
      selectedAppliance: null 
    }]);
  };

  // Remove appliance row
  const removeAppliance = (index) => {
    if (appliances.length > 1) {
      const updated = appliances.filter((_, i) => i !== index);
      setAppliances(updated);
    }
  };

  // Calculate total load
  const calculateTotalLoad = () => {
    let total = 0;
    const applianceDetails = [];

    appliances.forEach(app => {
      if (app.selectedAppliance && app.wattage && app.quantity) {
        const wattage = parseFloat(app.wattage);
        const quantity = parseInt(app.quantity);
        const multiplier = app.selectedAppliance.multiplier;
        const calculatedLoad = quantity * wattage * multiplier;
        
        total += calculatedLoad;
        applianceDetails.push({
          name: app.selectedAppliance.name,
          wattage,
          quantity,
          multiplier,
          calculatedLoad
        });
      }
    });

    return { total, details: applianceDetails };
  };

  // Handle form submission and move to next step
  const handleSubmit = () => {
    const { total, details } = calculateTotalLoad();
    onChange({ 
      load: total.toString(),
      appliances: appliances,
      applianceDetails: details
    });
    onNext();
  };

  const { total } = calculateTotalLoad();

  return (
    <div className="step-content">
      <h2>Step 1: Load</h2>
      <p className="step-description">Search and select appliances to calculate your power load</p>

      <div className="appliance-list">
        {appliances.map((app, index) => (
          <div key={app.id || index} className="appliance-row">
            {/* Column 1: Search/Appliance Selection */}
            <div className="form-group appliance-search-group">
              <label htmlFor={`appliance-${index}`}>Appliance</label>
              <div className="search-container">
                <input
                  type="text"
                  id={`appliance-${index}`}
                  value={app.applianceName}
                  onChange={(e) => handleSearchChange(index, e.target.value)}
                  onFocus={() => setShowSuggestions(prev => ({ ...prev, [index]: true }))}
                  onBlur={() => setTimeout(() => setShowSuggestions(prev => ({ ...prev, [index]: false })), 200)}
                  placeholder="Search appliance..."
                  className="search-input"
                />
                {showSuggestions[index] && app.applianceName && (
                  <div className="suggestions-dropdown">
                    {getFilteredAppliances(app.applianceName).slice(0, 8).map((suggestion, i) => (
                      <div 
                        key={i} 
                        className="suggestion-item"
                        onClick={() => selectAppliance(index, suggestion)}
                      >
                        <span className="suggestion-name">{suggestion.name}</span>
                        <span className={`category-tag ${suggestion.category.toLowerCase()}`}>
                          {suggestion.category} (×{suggestion.multiplier})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {app.selectedAppliance && (
                <span className="appliance-info">
                  {app.selectedAppliance.wattage} | {app.selectedAppliance.category} (×{app.selectedAppliance.multiplier})
                </span>
              )}
            </div>

            {/* Column 2: Wattage Input with Upload Button */}
            <div className="form-group wattage-group">
              <label htmlFor={`wattage-${index}`}>Wattage (W)</label>
              <div className="wattage-input-row">
                <input
                  type="number"
                  id={`wattage-${index}`}
                  value={app.wattage}
                  onChange={(e) => handleWattageChange(index, e.target.value)}
                  placeholder="Enter wattage"
                  min="1"
                />
                <label className={`upload-btn ${analyzingIndex === index ? 'analyzing' : ''}`}>
                  <input
                    type="file"
                    accept="image/*"
                    ref={(el) => (fileInputRefs.current[index] = el)}
                    onChange={(e) => handleFileChange(index, e)}
                    disabled={analyzingIndex === index}
                  />
                  {analyzingIndex === index ? 'Analyzing...' : (
                    <>
                      <span>Upload</span>
                      <span>file</span>
                    </>
                  )}
                </label>
              </div>
              
              {/* Analysis Result */}
              {analyzingIndex === index && (
                <span className="analysis-status">Analyzing image...</span>
              )}
              {analysisResult && analyzingIndex === null && (
                <span className={`analysis-result ${analysisResult.wattage ? 'success' : 'error'}`}>
                  {analysisResult.wattage 
                    ? `✓ Detected: ${analysisResult.wattage}W (${analysisResult.confidence})` 
                    : `⚠ ${analysisResult.raw_text.substring(0, 50)}...`}
                </span>
              )}
            </div>

            {/* Column 3: Quantity Input */}
            <div className="form-group quantity-group">
              <label htmlFor={`quantity-${index}`}>Qty</label>
              <input
                type="number"
                id={`quantity-${index}`}
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
            {app.selectedAppliance && app.wattage && app.quantity && (
              <div className="calculation-preview">
                <span className="calc-formula">
                  {app.quantity} × {app.wattage} × {app.selectedAppliance.multiplier} = 
                  <strong> {app.quantity * parseFloat(app.wattage) * app.selectedAppliance.multiplier} W</strong>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add More Button */}
      <button type="button" className="btn btn-add" onClick={addAppliance}>
        + Add More Appliances
      </button>

      {/* Total Load Display */}
      {total > 0 && (
        <div className="total-load-display">
          <span>Total Load: </span>
          <strong>{total} W</strong>
        </div>
      )}

      {/* Submit Button */}
      <button 
        type="button" 
        className="btn btn-submit"
        onClick={handleSubmit}
        disabled={total === 0}
      >
        Submit Load ({total > 0 ? `${total} W` : '0 W'})
      </button>
    </div>
  );
};

export default Step1Load;