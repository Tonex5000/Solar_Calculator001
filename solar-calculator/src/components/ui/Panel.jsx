import './Panel.css';

export default function Panel({ children, className = '' }) {
  return (
    <div className={`panel ${className}`}>
      <div className="panel-accent-bar" />
      {children}
    </div>
  );
}
