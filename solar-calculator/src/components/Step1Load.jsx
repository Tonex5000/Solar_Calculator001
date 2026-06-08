const Step1Load = ({ data, onChange }) => {
  return (
    <div className="step-content">
      <h2>Step 1: Load</h2>
      <p className="step-description">Enter your power load in watts</p>
      
      <div className="form-group">
        <label htmlFor="load">Load (Watts)</label>
        <input
          type="number"
          id="load"
          name="load"
          value={data.load || ''}
          onChange={(e) => onChange({ load: e.target.value })}
          placeholder="e.g., 1000"
          min="1"
          autoFocus
        />
        <span className="hint">Total power consumption in watts</span>
      </div>
    </div>
  );
};

export default Step1Load;