import type { NavSnapshot } from '../types'

interface NavSnapshotGridProps {
  snapshots: NavSnapshot[]
}

const formatBn = (value: number | null) =>
  value === null
    ? 'n/a'
    : `TZS ${value.toLocaleString('en-US', {
        maximumFractionDigits: value < 10 ? 2 : 1,
      })} bn`

const formatPrice = (value: number | null) =>
  value === null ? '—' : `TZS ${value.toFixed(value >= 1000 ? 0 : 2)}`

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'n/a'

const NavSnapshotGrid = ({ snapshots }: NavSnapshotGridProps) => {
  if (!snapshots.length) return null

  return (
    <div className="panel nav-snapshots">
      <div className="panel__header">
        <h2>Latest NAV snapshots</h2>
        <span className="panel__helper">Top funds by reported NAV</span>
      </div>
      <div className="nav-snapshots__grid">
        {snapshots.map((snapshot) => (
          <article key={snapshot.fundId} className="nav-snapshot-card">
            <header className="nav-snapshot-card__header">
              <h3>{snapshot.label}</h3>
              <span>Updated {formatDate(snapshot.lastUpdated)}</span>
            </header>
            <dl className="nav-snapshot-card__stats">
              <div>
                <dt>Total NAV</dt>
                <dd>{formatBn(snapshot.navTotalBn)}</dd>
              </div>
              <div>
                <dt>NAV / unit</dt>
                <dd>{formatPrice(snapshot.navPerUnit)}</dd>
              </div>
              <div>
                <dt>Sale vs buy-back</dt>
                <dd>
                  {formatPrice(snapshot.salePrice)} · {formatPrice(snapshot.repurchasePrice)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}

export default NavSnapshotGrid

