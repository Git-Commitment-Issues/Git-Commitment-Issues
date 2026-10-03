import { useId } from 'react'
import { cn } from '@/lib/cn'
import './Input.css'

/**
 * Input — labeled text field with optional leading icon and hint/error text.
 * Associates label, hint, and error with the control via aria attributes.
 *
 * Props:
 *   label:  visible field label (recommended)
 *   icon:   leading lucide-react icon component (optional)
 *   hint:   helper text shown below the field
 *   error:  error message; when present, overrides hint and marks invalid
 *   ...any native <input> props (type, value, onChange, placeholder, ...)
 */
export function Input({
  label,
  icon: Icon,
  hint,
  error,
  id,
  className,
  ...props
}) {
  const reactId = useId()
  const inputId = id || reactId
  const describedById = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined

  return (
    <div className={cn('field', className)}>
      {label ? (
        <label htmlFor={inputId} className="field__label">
          {label}
        </label>
      ) : null}

      <div className={cn('field__control', error && 'field__control--error')}>
        {Icon ? <Icon className="field__icon" aria-hidden="true" /> : null}
        <input
          id={inputId}
          className="field__input"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedById}
          {...props}
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="field__error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
