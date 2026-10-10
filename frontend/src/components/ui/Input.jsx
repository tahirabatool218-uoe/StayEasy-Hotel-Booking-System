import { forwardRef, useId } from 'react';

const Input = forwardRef(function Input(
  { label, hint, error, icon, className = '', wrapperClassName = '', id, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={`ui-field ${wrapperClassName}`}>
      {label && (
        <label htmlFor={inputId} className="ui-field-label">
          {label}
        </label>
      )}
      <div className={`ui-field-control ${icon ? 'has-icon' : ''} ${error ? 'has-error' : ''}`}>
        {icon && <span className="ui-field-icon">{icon}</span>}
        <input ref={ref} id={inputId} className={`ui-input ${className}`} {...rest} />
      </div>
      {error ? (
        <span className="ui-field-error">{error}</span>
      ) : hint ? (
        <span className="ui-field-hint">{hint}</span>
      ) : null}
    </div>
  );
});

export default Input;
