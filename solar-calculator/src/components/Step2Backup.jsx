const Step2Backup = ({ data, onChange }) => {
  return (
    <div className="step-content">
      <h2>Step 3: Backup Hours</h2>
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
        <label>Battery Type</label>
        <div className="radio-group">
          <label className={`radio-option ${data.battery_type === 'tubular' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_type"
              value="tubular"
              checked={data.battery_type === 'tubular'}
              onChange={(e) => onChange({ battery_type: e.target.value })}
            />
            <span className="radio-label">Tubular</span>
          </label>
          
          <label className={`radio-option ${data.battery_type === 'lithium' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="battery_type"
              value="lithium"
              checked={data.battery_type === 'lithium'}
              onChange={(e) => onChange({ battery_type: e.target.value })}
            />
            <span className="radio-label">Lithium</span>
          </label>
        </div>
        <span className="hint">Lithium batteries are lighter, faster charging, and last longer than tubular</span>
      </div>
    </div>
  );
};

export default Step2Backup;
