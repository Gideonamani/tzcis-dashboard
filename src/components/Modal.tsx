import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

const modalRoot = typeof document !== 'undefined' ? document.body : null

const Modal = ({ title, subtitle, onClose, children }: ModalProps) => {
  useEffect(() => {
    if (!modalRoot) return
    const originalOverflow = modalRoot.style.overflow
    modalRoot.style.overflow = 'hidden'

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => {
      modalRoot.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  if (!modalRoot) return null

  const modalContent = (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal__backdrop" onClick={onClose} />
      <section className="modal__dialog">
        <header className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="modal__close" aria-label="Close expanded view" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M6 18L18 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  )

  return createPortal(modalContent, modalRoot)
}

export default Modal
