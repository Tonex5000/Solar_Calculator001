const Step2Backup = ({ data, onChange }) => {
  return (
    <div className="step-content">
      <h2>Step 2: Battery Settings</h2>
      <p className="step-description">Configure your battery backup requirements</p>
      
      <div className="form-group">
        <label htmlFor="backup_hours">Backup Hours (1-12)</label>
        <input
          type="number"
          id="backup_hours"
          name="backup_hours"
          value={data.backup_hours || ''}
          onChange={(e) => onChange({ backup_hours: e.target.value })}
          placeholder="e.g., 6"
          min="1"
          max="12"
          autoFocus
        />
        <span className="hint">Number of hours the system should provide power when there's no sunlight</span>
      </div>

      <div className="form-group">
        <label>Battery Type</label>
        <div className="radio-group">
          <label className={`radio-option ${data.battery_type === 'tubular' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_type"
              value="tubular"
              checked={data.battery_type === 'tubular'}
              onChange={(e) => onChange({ battery_eff: 0.8, battery_type: e.target.value })}
            />
            <span className="radio-label">Tubular (Lead Acid)</span>
          </label>
          
          <label className={`radio-option ${data.battery_type === 'lithium' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_type"
              value="lithium"
              checked={data.battery_type === 'lithium'}
              onChange={(e) => onChange({ battery_eff: 0.95, battery_type: e.target.value })}
            />
            <span className="radio-label">Lithium</span>
          </label>
        </div>
        <span className="hint">Lithium batteries are lighter, faster charging, and last longer than tubular</span>
      </div>

      <div className="form-group">
        <label htmlFor="battery_voltage">Battery Voltage</label>
        <select
          id="battery_voltage"
          name="battery_voltage"
          value={data.battery_voltage || ''}
          onChange={(e) => onChange({ battery_voltage: parseInt(e.target.value) })}
        >
          <option value="">Select voltage...</option>
          <option value="12">12V (Small Systems)</option>
          <option value="24">24V (Medium Systems)</option>
          <option value="48">48V (Large Systems)</option>
        </select>
        <span className="hint">Higher voltage systems are more efficient for larger loads</span>
      </div>
    </div>
  );
};

export default Step2Backup;
