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
    </div>
  );
};

export default Step2Backup;