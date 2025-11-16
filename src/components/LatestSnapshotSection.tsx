import { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'

import Skeleton from './Skeleton'
import type { LatestFundSnapshot } from '../types'

interface LatestSnapshotSectionProps {
  snapshots: LatestFundSnapshot[]
  loading: boolean
  error: string | null
  lastSynced: Date | null
  onRetry?: () => void
}

const formatTzsBn = (value: number | null) =>
  value === null
    ? 'n/a'
    : `TZS ${value.toLocaleString('en-US', {
        maximumFractionDigits: value < 10 ? 2 : 1,
      })} bn`

const formatPrice = (value: number | null) =>
  value === null ? '—' : `TZS ${value.toFixed(value >= 1000 ? 0 : 2)}`

const formatDate = (value: string | null) => {
  if (!value) return 'n/a'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const freshnessDescriptor = (snapshot: LatestFundSnapshot) => {
  const reference = snapshot.collectedAt ?? snapshot.date
  if (!reference) {
    return { label: 'Unknown', className: 'status-pill status-pill--unknown', progress: 0, days: NaN }
  }
  const timestamp = new Date(reference).getTime()
  if (Number.isNaN(timestamp)) {
    return { label: 'Unknown', className: 'status-pill status-pill--unknown', progress: 0, days: NaN }
  }

  const diffDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24)
  const BASE_CLASS = 'status-pill'
  const result =
    diffDays <= 2
      ? { label: 'Fresh', className: `${BASE_CLASS} status-pill--fresh` }
      : diffDays <= 5
        ? { label: 'Recent', className: `${BASE_CLASS} status-pill--recent` }
        : { label: 'Needs update', className: `${BASE_CLASS} status-pill--stale` }

  const maxDays = 10
  const progress = Math.max(0, Math.min(100, (diffDays / maxDays) * 100))
  return { ...result, days: diffDays, progress }
}

const initialsFromFundId = (fundId: string) => {
  const parts = fundId.split(/[.\s_-]+/)
  if (!parts.length) return '—'
  const initials = parts
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return initials || fundId.slice(0, 2).toUpperCase()
}

const friendlyFundLabel = (fundId: string) =>
  fundId
    .split('.')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')

const computeSpread = (snapshot: LatestFundSnapshot): number | null => {
  const sale = snapshot.salePrice ?? snapshot.navPerUnit
  const rep = snapshot.repurchasePrice ?? snapshot.navPerUnit
  if (sale === null || sale === undefined || rep === null || rep === undefined) return null
  return Math.abs(sale - rep)
}

const spreadClassName = (spread: number | null) => {
  if (spread === null) return 'spread-pill spread-pill--na'
  if (spread <= 0.5) return 'spread-pill spread-pill--tight'
  if (spread <= 2) return 'spread-pill spread-pill--mid'
  return 'spread-pill spread-pill--wide'
}

const LatestSnapshotSection = ({ snapshots, loading, error, lastSynced, onRetry }: LatestSnapshotSectionProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const showInitialSkeleton = loading && !snapshots.length

  const summary = useMemo(() => {
    if (!snapshots.length) {
      return {
        totalNavBn: null,
        averageNavPerUnit: null,
        freshCount: 0,
        medianSpread: null,
      }
    }

    const totalNav = snapshots.reduce((sum, snapshot) => sum + (snapshot.navTotal ?? 0), 0)

    const navPerUnitValues = snapshots
      .map((snapshot) => snapshot.navPerUnit)
      .filter((value): value is number => value !== null)

    const saleRepSpreads = snapshots
      .map((snapshot) => {
        const sale = snapshot.salePrice ?? snapshot.navPerUnit
        const rep = snapshot.repurchasePrice ?? snapshot.navPerUnit
        if (sale === null || sale === undefined || rep === null || rep === undefined) return null
        return Math.abs(sale - rep)
      })
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b)

    const mid = Math.floor(saleRepSpreads.length / 2)
    const medianSpread = saleRepSpreads.length
      ? saleRepSpreads.length % 2
        ? saleRepSpreads[mid]
        : (saleRepSpreads[mid - 1] + saleRepSpreads[mid]) / 2
      : null

    const freshCount = snapshots.filter((snapshot) => freshnessDescriptor(snapshot).className.includes('fresh')).length

    return {
      totalNavBn: totalNav ? totalNav / 1_000_000_000 : null,
      averageNavPerUnit: navPerUnitValues.length
        ? navPerUnitValues.reduce((sum, value) => sum + value, 0) / navPerUnitValues.length
        : null,
      freshCount,
      medianSpread,
    }
  }, [snapshots])

  const navLeaders = useMemo(() => {
    return [...snapshots]
      .filter((snapshot) => snapshot.navTotal !== null)
      .sort((a, b) => (b.navTotal ?? 0) - (a.navTotal ?? 0))
      .slice(0, 8)
      .map((snapshot) => ({
        fundId: snapshot.fundId,
        value: Number(((snapshot.navTotal ?? 0) / 1_000_000_000).toFixed(2)),
      }))
  }, [snapshots])

  const spreadLeaders = useMemo(() => {
    return snapshots
      .map((snapshot) => {
        const sale = snapshot.salePrice ?? snapshot.navPerUnit
        const rep = snapshot.repurchasePrice ?? snapshot.navPerUnit
        if (sale === null || sale === undefined || rep === null || rep === undefined) return null
        return {
          fundId: snapshot.fundId,
          spread: Number(Math.abs(sale - rep).toFixed(3)),
        }
      })
      .filter((entry): entry is { fundId: string; spread: number } => Boolean(entry))
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 8)
  }, [snapshots])

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    const sorted = [...snapshots].sort((a, b) => (b.navTotal ?? 0) - (a.navTotal ?? 0))
    if (!term) return sorted
    return sorted.filter((snapshot) => snapshot.fundId.toLowerCase().includes(term))
  }, [snapshots, searchTerm])

  return (
    <section className="panel latest-section">
      <div className="latest-section__header">
        <div>
          <h2>Live fund snapshot</h2>
          <p>One row per fund from the `_latestFundData` sheet, rebuilt by the Apps Script pipeline.</p>
        </div>
        <div className="latest-section__meta">
          {lastSynced ? <span>Synced {lastSynced.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span> : null}
          {onRetry ? (
            <button className="latest-section__refresh" type="button" onClick={onRetry} disabled={loading}>
              Refresh
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="latest-section__error">
          <strong>Could not load the live snapshot.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {showInitialSkeleton ? (
        <LatestSnapshotSkeleton />
      ) : !snapshots.length ? (
        <div className="latest-section__empty">No data returned from the live snapshot feed.</div>
      ) : (
        <>
          {loading ? (
            <div className="latest-section__updating" aria-live="polite">
              <span className="sr-only">Refreshing live snapshot data…</span>
              <Skeleton width="140px" height="12px" className="skeleton--pill" />
            </div>
          ) : null}

          <div className="snapshot-metrics">
            <article className="snapshot-metric">
              <span className="snapshot-metric__label">Aggregate NAV</span>
              <strong className="snapshot-metric__value">{formatTzsBn(summary.totalNavBn)}</strong>
              <span className="snapshot-metric__helper">Summed nav_total across all funds</span>
            </article>
            <article className="snapshot-metric">
              <span className="snapshot-metric__label">Average NAV / unit</span>
              <strong className="snapshot-metric__value">{formatPrice(summary.averageNavPerUnit)}</strong>
              <span className="snapshot-metric__helper">Simple average, latest snapshot</span>
            </article>
            <article className="snapshot-metric">
              <span className="snapshot-metric__label">Fresh uploads</span>
              <strong className="snapshot-metric__value">{summary.freshCount}</strong>
              <span className="snapshot-metric__helper">Reported within the last 48 hours</span>
            </article>
            <article className="snapshot-metric">
              <span className="snapshot-metric__label">Median spread</span>
              <strong className="snapshot-metric__value">{formatPrice(summary.medianSpread)}</strong>
              <span className="snapshot-metric__helper">Sale vs repurchase</span>
            </article>
          </div>

          <div className="snapshot-controls">
            <label className="snapshot-search">
              <span>Filter funds</span>
              <input
                type="search"
                placeholder="Search fund id"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <div className="latest-section__meta latest-section__meta--inline">
              {lastSynced ? <span>Last synced {lastSynced.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> : null}
            </div>
          </div>

          <div className="snapshot-charts">
            <div className="snapshot-chart">
              <div className="snapshot-chart__header">
                <h3>Top NAV leaders</h3>
                <span>TZS billions</span>
              </div>
              {navLeaders.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={navLeaders} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="fundId" angle={-20} textAnchor="end" height={70} interval={0} />
                    <YAxis tickFormatter={(value) => `${value}`} width={40} />
                    <Tooltip
                      formatter={(value) => [
                        Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 }),
                        'TZS bn',
                      ]}
                    />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} unit="TZS bn" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="snapshot-chart__empty">NAV totals missing from feed.</p>
              )}
            </div>

            <div className="snapshot-chart">
              <div className="snapshot-chart__header">
                <h3>Pricing spreads</h3>
                <span>Sale – repurchase</span>
              </div>
              {spreadLeaders.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={spreadLeaders} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="fundId" angle={-20} textAnchor="end" height={70} interval={0} />
                    <YAxis tickFormatter={(value) => `${value}`}
                      width={40}
                    />
                    <Tooltip formatter={(value) => [Number(value).toFixed(3), 'TZS']} />
                    <Bar dataKey="spread" fill="#f97316" radius={[6, 6, 0, 0]} unit="TZS" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="snapshot-chart__empty">Sale and repurchase prices not available.</p>
              )}
            </div>
          </div>

          <div className="snapshot-table">
            <div className="snapshot-table__header">
              <h3>Latest fund rows</h3>
              <span>{filteredRows.length} funds</span>
            </div>
            <div className="snapshot-table__scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fund</th>
                    <th>Date</th>
                    <th className="numeric-col">NAV (TZS)</th>
                    <th className="numeric-col">Units</th>
                    <th className="numeric-col">NAV / unit</th>
                    <th className="numeric-col">Sale · Repurchase</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((snapshot) => {
                    const status = freshnessDescriptor(snapshot)
                    const spread = computeSpread(snapshot)
                    return (
                      <tr key={snapshot.fundId}>
                        <td>
                          <div className="fund-cell">
                            <span className="fund-avatar" aria-hidden="true">
                              {initialsFromFundId(snapshot.fundId)}
                            </span>
                            <div className="fund-cell__text">
                              <strong>{friendlyFundLabel(snapshot.fundId)}</strong>
                              <small>{snapshot.fundId}</small>
                            </div>
                          </div>
                        </td>
                        <td>{formatDate(snapshot.date)}</td>
                        <td className="numeric-col">
                          {snapshot.navTotal === null
                            ? '—'
                            : snapshot.navTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="numeric-col">
                          {snapshot.unitsOutstanding === null
                            ? '—'
                            : snapshot.unitsOutstanding.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="numeric-col">{formatPrice(snapshot.navPerUnit)}</td>
                        <td className="numeric-col spread-cell">
                          <span>{formatPrice(snapshot.salePrice)} · {formatPrice(snapshot.repurchasePrice)}</span>
                          <span className={spreadClassName(spread)}>
                            {spread === null ? 'n/a' : `Δ TZS ${spread.toFixed(spread < 1 ? 3 : 2)}`}
                          </span>
                        </td>
                        <td>
                          <div className="freshness-cell">
                            <span className={status.className}>{status.label}</span>
                            <div className="freshness-meter" aria-hidden="true">
                              <span style={{ width: `${status.progress ?? 0}%` }} />
                            </div>
                            {snapshot.collectedAt ? (
                              <small className="snapshot-table__collected">
                                {formatDate(snapshot.collectedAt)}
                              </small>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

const LatestSnapshotSkeleton = () => (
  <div className="latest-skeleton">
    <div className="snapshot-metrics">
      {Array.from({ length: 4 }).map((_, idx) => (
        <article key={`snapshot-metric-skeleton-${idx}`} className="snapshot-metric snapshot-metric--skeleton">
          <Skeleton width="50%" height="12px" />
          <Skeleton width="70%" height="26px" />
          <Skeleton width="60%" height="12px" />
        </article>
      ))}
    </div>

    <div className="snapshot-controls snapshot-controls--skeleton">
      <div className="snapshot-search snapshot-search--skeleton">
        <Skeleton width="40%" height="12px" />
        <Skeleton width="100%" height="42px" />
      </div>
      <Skeleton width="30%" height="14px" className="skeleton--pill" />
    </div>

    <div className="snapshot-charts snapshot-charts--skeleton">
      {Array.from({ length: 2 }).map((_, idx) => (
        <div key={`snapshot-chart-skeleton-${idx}`} className="snapshot-chart snapshot-chart--skeleton">
          <Skeleton width="35%" height="14px" />
          <Skeleton width="100%" height="220px" />
        </div>
      ))}
    </div>
  </div>
)

export default LatestSnapshotSection
