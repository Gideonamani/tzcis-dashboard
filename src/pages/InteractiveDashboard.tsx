import { useEffect, useMemo, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toPng } from 'html-to-image'
import { fetchNavSeries } from '../services/navData'
import type { FundNavPoint, FundNavSeries } from '../types'
import './InteractiveDashboard.css'

type ThemeMode = 'dark' | 'light'

const THEME_TOKENS: Record<
  ThemeMode,
  {
    background: string
    panelBackground: string
    panelBorder: string
    textDefault: string
    textMuted: string
    accent: string
    accentStrong: string
  }
> = {
  dark: {
    background: '#050819',
    panelBackground: '#131c31',
    panelBorder: 'rgba(148, 163, 184, 0.2)',
    textDefault: '#f1f5f9',
    textMuted: '#94a3b8',
    accent: '#818cf8',
    accentStrong: '#a78bfa',
  },
  light: {
    background: '#f5f7fb',
    panelBackground: '#ffffff',
    panelBorder: 'rgba(15, 23, 42, 0.08)',
    textDefault: '#0f172a',
    textMuted: '#475569',
    accent: '#6366f1',
    accentStrong: '#4c1d95',
  },
}

const QUICK_RANGES: Array<{ label: string; value: number | 'max' }> = [
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
  { label: '180d', value: 180 },
  { label: '1y', value: 365 },
  { label: 'Max', value: 'max' },
]

const formatNumber = (value: number | null | undefined, fractionDigits = 4) => {
  if (!Number.isFinite(value ?? null)) return '—'
  return (value as number).toFixed(fractionDigits)
}

const formatPercent = (value: number | null, fractionDigits = 2) => {
  if (!Number.isFinite(value ?? null)) return '—'
  return `${((value as number) * 100).toFixed(fractionDigits)}%`
}

const getUtcDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

const formatDisplayDate = (
  iso: string,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
) => {
  if (!iso) return ''
  const date = getUtcDate(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-GB', options)
}

const pctChange = (current?: number | null, previous?: number | null) => {
  if (!Number.isFinite(current ?? null) || !Number.isFinite(previous ?? null) || !previous) {
    return null
  }
  if (previous === 0) return null
  return ((current as number) - (previous as number)) / (previous as number)
}

const calcMaxDrawdown = (points: FundNavPoint[]) => {
  let maxValue = Number.NEGATIVE_INFINITY
  let maxDrawdown = 0

  points.forEach((point) => {
    if (!Number.isFinite(point.navPerUnit)) {
      return
    }
    const nav = point.navPerUnit as number
    if (nav > maxValue) {
      maxValue = nav
    }
    const drawdown = (nav - maxValue) / maxValue
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown
    }
  })

  return maxDrawdown
}

const csvEscape = (value: string | number | null | undefined) => {
  if (value === undefined || value === null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const csvNumber = (value: number | null | undefined) =>
  Number.isFinite(value ?? null) ? (value as number).toString() : ''

const InteractiveDashboard = () => {
  const [series, setSeries] = useState<FundNavSeries[]>([])
  const [selectedFundId, setSelectedFundId] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const chartRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let ignore = false

    const loadNav = async () => {
      try {
        setLoading(true)
        setError(null)
        const navSeries = await fetchNavSeries()
        if (!ignore) {
          setSeries(navSeries)
          if (navSeries.length) {
            setSelectedFundId(navSeries[0].fundId)
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Unable to load NAV data')
        }
      } finally {
        if (!ignore) {
          setLoading(false)
        }
      }
    }

    loadNav()

    return () => {
      ignore = true
    }
  }, [])

  const selectedSeries = useMemo(
    () => series.find((entry) => entry.fundId === selectedFundId),
    [series, selectedFundId],
  )

  useEffect(() => {
    if (!selectedSeries?.points.length) return
    const first = selectedSeries.points[0]
    const last = selectedSeries.points[selectedSeries.points.length - 1]
    setStartDate(first.date)
    setEndDate(last.date)
  }, [selectedSeries])

  const filteredPoints = useMemo(() => {
    if (!selectedSeries?.points.length) return []
    return selectedSeries.points.filter((point) => {
      if (startDate && point.date < startDate) return false
      if (endDate && point.date > endDate) return false
      return true
    })
  }, [selectedSeries, startDate, endDate])

  const metricReadyPoints = useMemo(
    () => filteredPoints.filter((point) => Number.isFinite(point.navPerUnit)),
    [filteredPoints],
  )

  const metrics = useMemo(() => {
    if (metricReadyPoints.length < 2) {
      return {
        oneDay: null,
        mtd: null,
        ytd: null,
        maxDrawdown: null,
      }
    }

    const last = metricReadyPoints[metricReadyPoints.length - 1]
    const prev = metricReadyPoints[metricReadyPoints.length - 2]
    const oneDay = pctChange(last.navPerUnit, prev.navPerUnit)

    const monthPrefix = last.date.slice(0, 7)
    const monthStart = metricReadyPoints.find((point) => point.date.slice(0, 7) === monthPrefix)
    const mtd = monthStart ? pctChange(last.navPerUnit, monthStart.navPerUnit) : null

    const yearPrefix = last.date.slice(0, 4)
    const ytdPoint = metricReadyPoints.find((point) => point.date.startsWith(yearPrefix))
    const ytd = ytdPoint ? pctChange(last.navPerUnit, ytdPoint.navPerUnit) : null

    const maxDrawdown = calcMaxDrawdown(metricReadyPoints)

    return { oneDay, mtd, ytd, maxDrawdown }
  }, [metricReadyPoints])

  const handleQuickRange = (range: number | 'max') => {
    if (!selectedSeries?.points.length) return
    const points = selectedSeries.points
    const last = points[points.length - 1]
    if (!last) return
    const lastDate = getUtcDate(last.date)

    if (range === 'max') {
      setStartDate(points[0].date)
      setEndDate(last.date)
      return
    }

    const start = new Date(lastDate)
    start.setUTCDate(start.getUTCDate() - range)
    const isoStart = start.toISOString().slice(0, 10)
    const clampedStart =
      points.find((point) => point.date >= isoStart)?.date ?? points[0].date ?? isoStart
    setStartDate(clampedStart)
    setEndDate(last.date)
  }

  const handleResetDates = () => {
    if (!selectedSeries?.points.length) return
    setStartDate(selectedSeries.points[0].date)
    setEndDate(selectedSeries.points[selectedSeries.points.length - 1].date)
  }

  const handleExportPng = async () => {
    if (!chartRef.current) return
    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
        backgroundColor: THEME_TOKENS[theme].background,
      })
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${selectedSeries?.fundId ?? 'nav-chart'}_${Date.now()}.png`
      link.click()
    } catch (err) {
      console.error('Failed to export chart', err)
    }
  }

  const handleDownloadCsv = () => {
    if (!selectedSeries?.points.length) return
    const header = 'date,nav_per_unit,sale_price,repurchase_price'
    const rows = selectedSeries.points.map((point) =>
      [point.date, csvNumber(point.navPerUnit), csvNumber(point.salePrice), csvNumber(point.repurchasePrice)]
        .map(csvEscape)
        .join(','),
    )
    const csvContent = [header, ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedSeries.fundId}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const chartData = useMemo(
    () =>
      filteredPoints.map((point) => ({
        date: point.date,
        nav: point.navPerUnit,
      })),
    [filteredPoints],
  )

  const tableRows = useMemo(() => {
    if (!filteredPoints.length) return []
    return filteredPoints.slice(-15).reverse()
  }, [filteredPoints])

  const lastDataPoint = filteredPoints[filteredPoints.length - 1]

  const themeToggleLabel = theme === 'dark' ? 'Dark mode' : 'Light mode'
  const themeColors = THEME_TOKENS[theme]

  return (
    <div className="interactive-page" data-theme={theme}>
      <div className="interactive-page__shell">
        <header className="interactive-page__header">
          <div>
            <p className="interactive-page__eyebrow">Interactive Explorer</p>
            <h1>CIS Performance Dashboard</h1>
            <p className="interactive-page__subtitle">
              Track daily NAV performance, export data, and quickly slice by date range.
            </p>
          </div>
          <div className="interactive-page__header-actions">
            <button type="button" className="ghost-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            </button>
            <button type="button" onClick={handleResetDates} disabled={!filteredPoints.length}>
              Reset dates
            </button>
            <button type="button" onClick={handleExportPng} disabled={!chartData.length}>
              Export chart PNG
            </button>
            <button type="button" onClick={handleDownloadCsv} disabled={!selectedSeries}>
              Download CSV
            </button>
          </div>
        </header>

        {error ? (
          <div className="panel panel--error">
            <p>Unable to load NAV data.</p>
            <p className="panel__helper">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="panel panel--loading">
            <p>Loading NAV series…</p>
          </div>
        ) : null}

        {!loading && !selectedSeries ? (
          <div className="panel panel--empty">
            <p>No NAV series available.</p>
          </div>
        ) : null}

        {selectedSeries ? (
          <>
            <section className="interactive-page__filters">
              <div className="filter-card">
                <label htmlFor="fund-selector">Select fund</label>
                <select
                  id="fund-selector"
                  value={selectedFundId}
                  onChange={(event) => setSelectedFundId(event.target.value)}
                >
                  {series.map((entry) => (
                    <option key={entry.fundId} value={entry.fundId}>
                      {entry.label}
                    </option>
                  ))}
                </select>
                <p className="filter-card__meta">
                  {lastDataPoint ? `Last updated: ${formatDisplayDate(lastDataPoint.date)}` : '—'}
                </p>
              </div>

              <div className="filter-card filter-card--range">
                <div>
                  <label htmlFor="start-date">Start date</label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    max={endDate || undefined}
                  />
                </div>
                <div>
                  <label htmlFor="end-date">End date</label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    min={startDate || undefined}
                    max={selectedSeries.points[selectedSeries.points.length - 1]?.date}
                  />
                </div>
                <div className="quick-ranges">
                  <span>Quick range:</span>
                  {QUICK_RANGES.map((range) => (
                    <button
                      type="button"
                      key={range.label}
                      className="ghost-button"
                      onClick={() => handleQuickRange(range.value)}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-card filter-card--kpi">
                <p className="kpi-label">1-Day NAV Change (%)</p>
                <p
                  className={[
                    'kpi-value',
                    metrics.oneDay !== null
                      ? metrics.oneDay > 0
                        ? 'kpi-value--positive'
                        : metrics.oneDay < 0
                          ? 'kpi-value--negative'
                          : 'kpi-value--neutral'
                      : '',
                  ].join(' ')}
                >
                  {metrics.oneDay === null ? '--' : (metrics.oneDay * 100).toFixed(3) + '%'}
                </p>
                <div className="kpi-grid">
                  <div>
                    <p>MTD</p>
                    <strong>{formatPercent(metrics.mtd)}</strong>
                  </div>
                  <div>
                    <p>YTD</p>
                    <strong>{formatPercent(metrics.ytd)}</strong>
                  </div>
                  <div>
                    <p>Max DD</p>
                    <strong>
                      {metrics.maxDrawdown === null
                        ? '—'
                        : `${(metrics.maxDrawdown * 100).toFixed(2)}%`}
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="interactive-page__content">
              <div className="panel panel--chart" ref={chartRef}>
                <div className="panel__header">
                  <div>
                    <h2>NAV Per Unit — Historical Performance</h2>
                    <p className="panel__helper">
                      {startDate && endDate
                        ? `${formatDisplayDate(startDate)} → ${formatDisplayDate(endDate)}`
                        : 'Select a range to render the chart'}
                    </p>
                  </div>
                </div>
                <div className="chart-wrapper">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={themeColors.panelBorder} strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: themeColors.textMuted, fontSize: 12 }}
                          tickFormatter={(value) =>
                            formatDisplayDate(value, { day: '2-digit', month: 'short' })
                          }
                        />
                        <YAxis
                          tick={{ fill: themeColors.textMuted, fontSize: 12 }}
                          domain={['auto', 'auto']}
                          width={70}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: themeColors.panelBackground,
                            border: `1px solid ${themeColors.panelBorder}`,
                            borderRadius: '0.5rem',
                            color: themeColors.textDefault,
                          }}
                          formatter={(value: number | string | Array<number | string>) => {
                            const resolvedValue = Array.isArray(value)
                              ? Number(value[0])
                              : Number(value ?? 0)
                            return [
                              Number.isFinite(resolvedValue)
                                ? resolvedValue.toFixed(4)
                                : 'n/a',
                              'NAV/Unit',
                            ]
                          }}
                          labelFormatter={(label) =>
                            `Date: ${formatDisplayDate(String(label), {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}`
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="nav"
                          stroke={themeColors.accent}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: themeColors.accentStrong }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="panel__empty">No data points for this selection.</div>
                  )}
                </div>
              </div>

              <div className="panel panel--table">
                <div className="panel__header">
                  <h2>Recent Daily Values</h2>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>NAV/Unit</th>
                        <th>Sale Price</th>
                        <th>Repurchase</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.length ? (
                        tableRows.map((row) => (
                          <tr key={`${row.fundId}-${row.date}`}>
                            <td>{row.date}</td>
                            <td>{formatNumber(row.navPerUnit)}</td>
                            <td>{formatNumber(row.salePrice)}</td>
                            <td>{formatNumber(row.repurchasePrice)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="panel__empty">
                            No rows for the selected range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">
        {themeToggleLabel}
      </span>
    </div>
  )
}

export default InteractiveDashboard
