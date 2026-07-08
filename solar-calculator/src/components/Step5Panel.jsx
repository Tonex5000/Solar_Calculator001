const Step5Panel = ({ data, onChange }) => {
  const panels = [
    { value: '300', label: '300W' },
    { value: '400', label: '400W' },
    { value: '500', label: '500W' },
    { value: '550', label: '550W' },
    { value: '580', label: '580W' },
    { value: '630', label: '630W' },
    { value: '650', label: '650W' },
  ];

  return (
    <div className="step-content">
      <h2>Step 4: Panel Wattage</h2>
      <p className="step-description">Select your solar panel wattage</p>
      
      <div className="form-group">
        <label>Panel Wattage</label>
        <div className="radio-group">
          {panels.map((panel) => (
            <label 
              key={panel.value} 
              className={`radio-option ${data.panel_wattage === panel.value ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="panel_wattage"
                value={panel.value}
                checked={data.panel_wattage === panel.value}
                onChange={(e) => onChange({ panel_wattage: e.target.value })}
              />
              <span className="radio-label">{panel.label}</span>
            </label>
          ))}
        </div>
        <span className="hint">Higher wattage panels generate more power but cost more</span>
      </div>
    </div>
  );
};

export default Step5Panel;