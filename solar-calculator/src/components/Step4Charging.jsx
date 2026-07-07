const Step4Charging = ({ data, onChange }) => {
  return (
    <div className="step-content">
      <h2>Step 3: Charging Hours</h2>
      <p className="step-description">How many peak sun hours are available for charging?</p>
      
      <div className="form-group">
        <label htmlFor="charging_hours">Charging Hours (1-12)</label>
        <input
          type="number"
          id="charging_hours"
          name="charging_hours"
          value={data.charging_hours || ''}
          onChange={(e) => onChange({ charging_hours: e.target.value })}
          placeholder="e.g., 5"
          min="1"
          max="12"
          autoFocus
        />
        <span className="hint warning">Typical: 4–6 hours</span>
      </div>
    </div>
  );
};

export default Step4Charging;