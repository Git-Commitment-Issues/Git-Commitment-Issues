import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import './Modal.css'

/**
 * Modal — a centered popup dialog over a scrim. Closes on Escape, scrim click,
 * or the close button. Locks body scroll while open. Rendered via a portal so
 * it's never clipped by page layout.
 *
 * Props:
 *   open:     boolean
 *   onClose:  () => void
 *   title:    optional header title
 *   size:     'sm' | 'md' | 'lg'  (max-width; default 'md')
 *   children: dialog body
 */
export function Modal({ open, onClose, title, size = 'md', children }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    // Lock scroll behind the modal.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        className={cn('modal__panel', `modal__panel--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          {title ? <h2 className="modal__title">{title}</h2> : <span />}
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
