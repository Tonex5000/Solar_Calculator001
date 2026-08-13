import './Field.css';

export default function Field({ mono = false, className = '', ...props }) {
  return (
    <input className={`field ${mono ? 'mono' : ''} ${className}`} {...props} />
  );
}
