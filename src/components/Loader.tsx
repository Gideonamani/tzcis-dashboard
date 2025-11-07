interface LoaderProps {
  message?: string
}

const Loader = ({ message = 'Loading…' }: LoaderProps) => (
  <div className="loader" role="status" aria-live="polite">
    <span className="loader__spinner" aria-hidden="true" />
    <span className="loader__label">{message}</span>
  </div>
)

export default Loader
