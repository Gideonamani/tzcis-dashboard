const THEME_BAR_OFFSETS = [22, 34, 46, 58]

interface LoaderProps {
  message?: string
  variant?: 'inline' | 'page'
}

const Loader = ({ message = 'Loading data…', variant = 'inline' }: LoaderProps) => {
  const className = ['loader', variant === 'page' ? 'loader--page' : ''].filter(Boolean).join(' ')

  return (
    <div className={className} role="status" aria-live="polite">
      <div className="loader__content loader__content--immersive">
        <div className="loader-themeMap loader-themeMap--app">
          <div className="loader-themeMap__halo" aria-hidden="true" />
          <div className="loader-themeMap__map" aria-hidden="true">
            {THEME_BAR_OFFSETS.map((offset, idx) => (
              <span
                key={`loader-bar-${idx}`}
                className="loader-themeMap__bar"
                style={{ animationDelay: `${idx * 0.16}s`, left: `${offset}%` }}
              />
            ))}
          </div>
          <div className="loader-themeMap__meta">
            <span className="loader__eyebrow">Preparing insights</span>
            <span className="loader__label">{message}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Loader
