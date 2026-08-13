import './Button.css';

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  return (
    <button className={`btn-shared ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
