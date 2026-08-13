import { useState } from 'react';
import Step1Load from './components/Step1Load';
import Step2Backup from './components/Step2Backup';
import Step4Charging from './components/Step4Charging';
import Step5Panel from './components/Step5Panel';
import Result from './components/Result';
import Panel from './components/ui/Panel';
import Stepper from './components/ui/Stepper';
import './App.css';

const TOTAL_STEPS = 4;
const STEP_LABELS = ['LOAD', 'BACKUP', 'CHARGING', 'PANEL'];

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    load: '',
    switching_volt: '',
    backup_hours: '',
    battery_type: '',
    battery_eff: '',
    charging_hours: '',
    panel_wattage: '',
    other_wattage: ''
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
               parseFloat(formData.backup_hours) <= 12 &&
               formData.battery_type !== '';
      case 3:
        return formData.charging_hours && 
               parseFloat(formData.charging_hours) >= 1 && 
               parseFloat(formData.charging_hours) <= 12;
      case 4:
        if (formData.panel_wattage === 'other') {
          return formData.other_wattage && parseInt(formData.other_wattage) > 0;
        }
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
      backup_hours: parseFloat(formData.backup_hours),
      battery_type: formData.battery_type,
      battery_eff: formData.battery_eff,
      switching_volt: formData.switching_volt,
      charging_hours: parseFloat(formData.charging_hours),
      panel_wattage: formData.panel_wattage === 'other' 
        ? parseInt(formData.other_wattage) 
        : parseInt(formData.panel_wattage)
    };

    try {
      const response = await fetch('https://solar-calculator001-7.onrender.com/calculate', {
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
      setCurrentStep(5);
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
      switching_volt: '',
      backup_hours: '',
      battery_type: '',
      battery_eff: '',
      charging_hours: '',
      panel_wattage: '',
      other_wattage: ''
    });
    setResults(null);
    setError(null);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Load data={formData} onChange={updateFormData} onNext={handleNext} />;
      case 2:
        return <Step2Backup data={formData} onChange={updateFormData} />;
      case 3:
        return <Step4Charging data={formData} onChange={updateFormData} />;
      case 4:
        return <Step5Panel data={formData} onChange={updateFormData} />;
      case 5:
        return <Result results={results} isLoading={isLoading} error={error} onReset={handleReset} formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <div className="ambient-bg" aria-hidden="true" />
      <div className="container">
        <header className="header">
          <div className="sq"></div>
          <span className="eyebrow">VOLTRA SYSTEM SIZING</span>
          <h1>LOAD <span className="accent">AUDIT</span></h1>
          <p>Calculate your solar power system requirements</p>
        </header>

        {currentStep <= 4 && (
          <Stepper steps={STEP_LABELS} currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        )}

        <Panel className="form-card">
          <div className="form-card-inner">
            {renderStep()}

            {currentStep <= 4 && currentStep !== 1 && (
              <div className="button-group">
                {currentStep > 1 && (
                  <button onClick={handleBack} className="btn btn-secondary" disabled={isLoading}>
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className={`btn btn-primary ${isLoading ? 'btn-loading' : ''}`}
                  disabled={!isStepValid(currentStep) || isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="btn-spinner"></span>
                      Calculating...
                    </>
                  ) : (
                    currentStep === TOTAL_STEPS ? 'Calculate' : 'Continue'
                  )}
                </button>
              </div>
            )}

            {isLoading && currentStep <= 4 && (
              <div className="loading-overlay">
                <div className="loading-spinner"></div>
                <p>Calculating your solar system...</p>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default App;
