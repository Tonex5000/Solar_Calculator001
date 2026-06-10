const Result = ({ results, isLoading, error, onReset }) => {
  if (isLoading) {
    return (
      <div className="step-content result-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Calculating your solar system...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="step-content result-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={onReset} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  return (
    <div className="step-content result-container">
      <h2>Your Solar System Results</h2>
      <p className="step-description">Based on your inputs, here's your recommended solar setup:</p>
      
      <div className="results-grid">
        <div className="result-card">
          <div className="result-icon">⚡</div>
          <div className="result-label">Inverter Size</div>
          <div className="result-value">{results.inverter_watts} KVA</div>
          <div className="result-note">Required inverter capacity</div>
        </div>
        
        <div className="result-card">
          <div className="result-icon">🔋</div>
          <div className="result-label">Battery Capacity</div>
          <div className="result-value">{results.battery_capacity} <span>Ah</span></div>
          <div className="result-note">Battery amp-hour rating</div>
        </div>
        
        <div className="result-card">
          <div className="result-icon">☀️</div>
          <div className="result-label">Solar Watts</div>
          <div className="result-value">{results.solar_watts} <span>W</span></div>
          <div className="result-note">Total solar panel wattage</div>
        </div>
        
        <div className="result-card">
          <div className="result-icon">📦</div>
          <div className="result-label">Number of Panels</div>
          <div className="result-value">{results.num_panels}</div>
          <div className="result-note">Panels needed</div>
        </div>
      </div>

      <button onClick={onReset} className="btn btn-primary btn-reset">
        Start New Calculation
      </button>
    </div>
  );
};

export default Result;
