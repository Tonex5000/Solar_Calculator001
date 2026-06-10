import { useState } from 'react';
import Step1Load from './components/Step1Load';
import Step2Backup from './components/Step2Backup';
import Step3Voltage from './components/Step3Voltage';
import Step4Charging from './components/Step4Charging';
import Step5Panel from './components/Step5Panel';
import Result from './components/Result';
import './App.css';

const TOTAL_STEPS = 5;

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    load: '',
    backup_hours: '',
    battery_eff:'',
    battery_voltage: '',
    charging_hours: '',
    panel_wattage: ''
  });
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const updateFormData = (newData) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  };

  const isStepValid = (step) => {
    switch (step) {
      case 1:
        return formData.load && parseFloat(formData.load) > 0;
      case 2:
        return formData.backup_hours && 
               parseFloat(formData.backup_hours) >= 1 && 
               parseFloat(formData.backup_hours) <= 12;
               formData.battery_eff !== '';
      case 3:
        return formData.battery_voltage !== '';
      case 4:
        return formData.charging_hours && 
               parseFloat(formData.charging_hours) >= 1 && 
               parseFloat(formData.charging_hours) <= 12;
      case 5:
        return formData.panel_wattage !== '';
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);

    const payload = {
      load: parseFloat(formData.load),
      backup_hours: parseInt(formData.backup_hours),
      battery_eff: parseFloat(formData.battery_eff),
      battery_voltage: parseInt(formData.battery_voltage),
      charging_hours: parseInt(formData.charging_hours),
      panel_wattage: parseInt(formData.panel_wattage)
    };

    try {
      const response = await fetch('https://solar-back-2.onrender.com/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
      setCurrentStep(6);
    } catch (err) {
      setError(err.message || 'Failed to calculate. Please check if the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setFormData({
      load: '',
      backup_hours: '',
      battery_eff: '',
      battery_voltage: '',
      charging_hours: '',
      panel_wattage: ''
    });
    setResults(null);
    setError(null);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Load data={formData} onChange={updateFormData} />;
      case 2:
        return <Step2Backup data={formData} onChange={updateFormData} />;
      case 3:
        return <Step3Voltage data={formData} onChange={updateFormData} />;
      case 4:
        return <Step4Charging data={formData} onChange={updateFormData} />;
      case 5:
        return <Step5Panel data={formData} onChange={updateFormData} />;
      case 6:
        return <Result results={results} isLoading={isLoading} error={error} onReset={handleReset} />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>☀️ Solar Sizing Calculator</h1>
          <p>Calculate your solar power system requirements</p>
        </header>

        {currentStep <= 5 && (
          <div className="step-indicator">
            <span className="step-text">Step {currentStep} of {TOTAL_STEPS}</span>
            <div className="step-dots">
              {[...Array(TOTAL_STEPS)].map((_, index) => (
                <div
                  key={index}
                  className={`step-dot ${index + 1 === currentStep ? 'active' : ''} ${index + 1 < currentStep ? 'completed' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="form-card">
          {renderStep()}

          {currentStep <= 5 && (
            <div className="button-group">
              {currentStep > 1 && (
                <button onClick={handleBack} className="btn btn-secondary">
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="btn btn-primary"
                disabled={!isStepValid(currentStep)}
              >
                {currentStep === TOTAL_STEPS ? 'Calculate' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
