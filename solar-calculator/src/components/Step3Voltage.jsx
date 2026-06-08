const Step3Voltage = ({ data, onChange }) => {
  return (
    <div className="step-content">
      <h2>Step 3: Battery Voltage</h2>
      <p className="step-description">Select your battery system voltage</p>
      
      <div className="form-group">
        <label>Battery Voltage</label>
        <div className="radio-group">
          <label className={`radio-option ${data.battery_voltage === '12' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_voltage"
              value="12"
              checked={data.battery_voltage === '12'}
              onChange={(e) => onChange({ battery_voltage: e.target.value })}
            />
            <span className="radio-label">12V</span>
          </label>
          
          <label className={`radio-option ${data.battery_voltage === '24' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_voltage"
              value="24"
              checked={data.battery_voltage === '24'}
              onChange={(e) => onChange({ battery_voltage: e.target.value })}
            />
            <span className="radio-label">24V</span>
          </label>
          
          <label className={`radio-option ${data.battery_voltage === '48' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_voltage"
              value="48"
              checked={data.battery_voltage === '48'}
              onChange={(e) => onChange({ battery_voltage: e.target.value })}
            />
            <span className="radio-label">48V</span>
          </label>
        </div>
        <span className="hint">Higher voltage = lower current = thinner cables for same power</span>
      </div>
    </div>
  );
};

export default Step3Voltage;