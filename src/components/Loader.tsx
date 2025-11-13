const BAR_COUNT = 4

interface LoaderProps {
  message?: string
  variant?: 'inline' | 'page'
}

const Loader = ({ message = 'Loading data…', variant = 'inline' }: LoaderProps) => {
  const className = ['loader', variant === 'page' ? 'loader--page' : ''].filter(Boolean).join(' ')

  return (
    <div className={className} role="status" aria-live="polite">
      <div className="loader__content">
        <div className="loader__viz" aria-hidden="true">
          <svg className="loader__map" viewBox="0 0 240 260" fill="none">
            <path
              d="M70 18h90l52 62-14 33 32 74-60 54-92-10L38 162 14 118l10-48 16-10 3-25Z"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div className="loader__bars">
            {Array.from({ length: BAR_COUNT }).map((_, idx) => (
              <span
                key={`loader-bar-${idx}`}
                className="loader__bar"
                style={{ animationDelay: `${idx * 0.12}s` }}
              />
            ))}
          </div>
        </div>
        <div className="loader__text">
          <span className="loader__eyebrow">Preparing insights</span>
          <span className="loader__label">{message}</span>
        </div>
      </div>
    </div>
  )
}

export default Loader
