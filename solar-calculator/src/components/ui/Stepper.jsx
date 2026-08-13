import './Stepper.css';

export default function Stepper({ steps, currentStep, totalSteps }) {
  const total = totalSteps || steps.length;
  const pct = (currentStep / total) * 100;
  return (
    <div className="rail">
      <div className="rail-top">
        {steps.map((label, i) => (
          <span key={label} className={i === currentStep - 1 ? 'current' : ''}>
            {String(i + 1).padStart(2, '0')} {label}
          </span>
        ))}
      </div>
      <div className="rail-track">
        <div className="rail-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
