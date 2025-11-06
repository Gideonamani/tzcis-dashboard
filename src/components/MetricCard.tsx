interface MetricCardProps {
  title: string
  value: string
  helperText?: string
}

const MetricCard = ({ title, value, helperText }: MetricCardProps) => (
  <div className="metric-card">
    <span className="metric-card__label">{title}</span>
    <strong className="metric-card__value">{value}</strong>
    {helperText ? <span className="metric-card__helper">{helperText}</span> : null}
  </div>
)

export default MetricCard
