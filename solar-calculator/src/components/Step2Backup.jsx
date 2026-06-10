const Step2Backup = ({ data, onChange }) => {
  return (
    <div className="step-content">
      <h2>Step 2: Backup Hours</h2>
      <p className="step-description">How many hours of backup power do you need?</p>
      
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
        <label>Battery Efficiency</label>
        <div className="radio-group">
          <label className={`radio-option ${data.battery_eff === '0.75' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_eff"
              value="0.75"
              checked={data.battery_eff === '0.75'}
              onChange={(e) => onChange({ battery_eff: e.target.value })}
            />
            <span className="radio-label">)0.75</span>
          </label>
          
          <label className={`radio-option ${data.battery_eff === '0.8' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_eff"
              value="0.8"
              checked={data.battery_eff === '0.8'}
              onChange={(e) => onChange({ battery_eff: e.target.value })}
            />
            <span className="radio-label">)0.8</span>
          </label>
          
          <label className={`radio-option ${data.battery_eff === '0.9' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_eff"
              value="0.9"
              checked={data.battery_eff === '0.9'}
              onChange={(e) => onChange({ battery_eff: e.target.value })}
            />
            <span className="radio-label">)0.9</span>
          </label>

          <label className={`radio-option ${data.battery_eff === '1' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_eff"
              value="1"
              checked={data.battery_eff === '1'}
              onChange={(e) => onChange({ battery_eff: e.target.value })}
            />
            <span className="radio-label">)1</span>
          </label>
        </div>
        <span className="hint">Higher voltage = lower current = thinner cables for same power</span>
      </div>
    </div>
  );
};

export default Step2Backup;
