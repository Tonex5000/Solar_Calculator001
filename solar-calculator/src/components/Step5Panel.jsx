import Field from './ui/Field';

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

  const isOtherSelected = data.panel_wattage === 'other';
  const otherWattage = data.other_wattage || '';

  const handlePanelChange = (value) => {
    onChange({ panel_wattage: value });
  };

  const handleOtherWattageChange = (value) => {
    onChange({ panel_wattage: 'other', other_wattage: value });
  };

  return (
    <div className="step-content">
      <span className="step-eyebrow">STEP 04 / 04</span>
      <h2>PANEL</h2>
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
                onChange={(e) => handlePanelChange(e.target.value)}
              />
              <span className="radio-label">{panel.label}</span>
            </label>
          ))}
          <label
            className={`radio-option ${isOtherSelected ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="panel_wattage"
              value="other"
              checked={isOtherSelected}
              onChange={() => handlePanelChange('other')}
            />
            <span className="radio-label">Other</span>
          </label>
        </div>

        {isOtherSelected && (
          <div className="form-group" style={{ marginTop: '15px', marginLeft: '20px' }}>
            <label htmlFor="other_wattage">Enter Custom Wattage (W)</label>
            <Field
              type="number"
              mono
              id="other_wattage"
              name="other_wattage"
              value={otherWattage}
              onChange={(e) => handleOtherWattageChange(e.target.value)}
              placeholder="e.g., 450"
              min="1"
              autoFocus
            />
            <span className="hint">Enter the wattage of your custom panel</span>
          </div>
        )}

        <span className="hint">Higher wattage panels generate more power but cost more</span>
      </div>
    </div>
  );
};

export default Step5Panel;
