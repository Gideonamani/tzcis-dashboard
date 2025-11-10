import { useState } from 'react'
import type { ReactNode } from 'react'

interface MetricCardProps {
  title: string
  value: string
  helperText?: string
  detailContent?: ReactNode
}

const MetricCard = ({ title, value, helperText, detailContent }: MetricCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const canExpand = Boolean(detailContent)

  return (
    <div className={`metric-card${expanded ? ' metric-card--expanded' : ''}`}>
      <div className="metric-card__header">
        <span className="metric-card__label">{title}</span>
        {canExpand ? (
          <button
            type="button"
            className="metric-card__toggle"
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${title}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              {expanded ? (
                <path
                  d="M5 12h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M12 5v14m-7-7h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>
        ) : null}
      </div>
      <strong className="metric-card__value">{value}</strong>
      {helperText ? <span className="metric-card__helper">{helperText}</span> : null}
      {canExpand && expanded ? (
        <div className="metric-card__details" role="region" aria-label={`${title} details`}>
          {detailContent}
        </div>
      ) : null}
    </div>
  )
}

export default MetricCard
