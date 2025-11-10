import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import './App.css'
import MetricCard from './components/MetricCard'
import FundsTable from './components/FundsTable'
import ManagerFilter from './components/ManagerFilter'
import Loader from './components/Loader'
import NavSnapshotGrid from './components/NavSnapshotGrid'
import { aggregateByManager, fetchFundData, FUNDS_CSV_URL } from './services/fundData'
import { fetchNavSeries } from './services/navData'
import type { FundNavSeries, FundRecord, NavSnapshot } from './types'

const ManagerAumChart = lazy(() => import('./components/ManagerAumChart'))
const ReturnsChart = lazy(() => import('./components/ReturnsChart'))
const NavTrendChart = lazy(() => import('./components/NavTrendChart'))
const NavPriceSpreadChart = lazy(() => import('./components/NavPriceSpreadChart'))
const AumBreakdownChart = lazy(() => import('./components/AumBreakdownChart'))
const PerformanceScatterPlot = lazy(() => import('./components/PerformanceScatterPlot'))

const AUM_BREAKDOWN_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f97316', '#a855f7', '#f43f5e']

const ChartFallback = ({ title, helper }: { title: string; helper?: string }) => (
  <div className="panel panel--loading">
    <div className="panel__header">
      <h2>{title}</h2>
      {helper ? <span className="panel__helper">{helper}</span> : null}
    </div>
    <div className="panel__empty">Loading visualization…</div>
  </div>
)

function App() {
  const [funds, setFunds] = useState<FundRecord[]>([])
  const [fundsLoading, setFundsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedManager, setSelectedManager] = useState('all')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [navSeries, setNavSeries] = useState<FundNavSeries[]>([])
  const [navLoading, setNavLoading] = useState(true)
  const [navError, setNavError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    const load = async () => {
      try {
        setFundsLoading(true)
        setError(null)
        const records = await fetchFundData()
        if (!ignore) {
          setFunds(records)
          setLastRefreshed(new Date())
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Unknown error fetching fund data')
        }
      } finally {
        if (!ignore) {
          setFundsLoading(false)
        }
      }
    }

    load()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    const loadNavSeries = async () => {
      try {
        setNavLoading(true)
        setNavError(null)
        const series = await fetchNavSeries()
        if (!ignore) {
          setNavSeries(series)
        }
      } catch (err) {
        if (!ignore) {
          setNavError(err instanceof Error ? err.message : 'Unknown error fetching NAV data')
        }
      } finally {
        if (!ignore) {
          setNavLoading(false)
        }
      }
    }

    loadNavSeries()

    return () => {
      ignore = true
    }
  }, [])

  const managerOptions = useMemo(() => {
    const managers = new Set<string>()
    funds.forEach((fund) => {
      if (fund.manager) managers.add(fund.manager)
    })
    return Array.from(managers).sort((a, b) => a.localeCompare(b))
  }, [funds])

  const filteredFunds = useMemo(() => {
    if (selectedManager === 'all') return funds
    return funds.filter((fund) => fund.manager === selectedManager)
  }, [funds, selectedManager])

  const summaryMetrics = useMemo(() => {
    if (!filteredFunds.length) {
      return {
        totalAum: 'n/a',
        fundCount: '0',
        averageOneYearReturn: 'n/a',
        averageThreeYearCagr: 'n/a',
      }
    }

    const totals = filteredFunds.reduce(
      (acc, fund) => {
        const aum = fund.currentAumBn ?? 0
        acc.totalAum += aum

        if (fund.oneYearReturn !== null && fund.oneYearReturn !== undefined) {
          acc.oneYearSum += fund.oneYearReturn
          acc.oneYearCount += 1
        }

        if (fund.threeYearCagr !== null && fund.threeYearCagr !== undefined) {
          acc.threeYearSum += fund.threeYearCagr
          acc.threeYearCount += 1
        }

        return acc
      },
      {
        totalAum: 0,
        oneYearSum: 0,
        oneYearCount: 0,
        threeYearSum: 0,
        threeYearCount: 0,
      },
    )

    return {
      totalAum: `TZS ${totals.totalAum.toLocaleString('en-US', {
        maximumFractionDigits: totals.totalAum < 10 ? 2 : 1,
      })} bn`,
      fundCount: filteredFunds.length.toString(),
      averageOneYearReturn:
        totals.oneYearCount > 0
          ? `${(totals.oneYearSum / totals.oneYearCount).toFixed(1)}%`
          : 'n/a',
      averageThreeYearCagr:
        totals.threeYearCount > 0
          ? `${(totals.threeYearSum / totals.threeYearCount).toFixed(1)}%`
          : 'n/a',
    }
  }, [filteredFunds])

  const managerAggregates = useMemo(
    () => aggregateByManager(filteredFunds),
    [filteredFunds],
  )

  const aumBreakdownData = useMemo(() => {
    if (!managerAggregates.length) return []
    const total = managerAggregates.reduce((sum, entry) => sum + entry.totalAumBn, 0)
    if (!total) return []

    const primarySlices = managerAggregates.slice(0, 5).map((entry, index) => ({
      name: entry.manager,
      value: entry.totalAumBn,
      percentage: (entry.totalAumBn / total) * 100,
      color: AUM_BREAKDOWN_COLORS[index % AUM_BREAKDOWN_COLORS.length],
    }))

    const otherValue = managerAggregates.slice(5).reduce((sum, entry) => sum + entry.totalAumBn, 0)
    if (otherValue > 0) {
      primarySlices.push({
        name: 'Other managers',
        value: otherValue,
        percentage: (otherValue / total) * 100,
        color: '#94a3b8',
      })
    }
    return primarySlices
  }, [managerAggregates])

  const performanceScatterData = useMemo(() => {
    const eligible = filteredFunds
      .filter(
        (fund) =>
          fund.oneYearReturn !== null &&
          fund.oneYearReturn !== undefined &&
          fund.threeYearCagr !== null &&
          fund.threeYearCagr !== undefined,
      )
      .map((fund) => ({
        fund: fund.fund,
        manager: fund.manager ?? undefined,
        oneYearReturn: fund.oneYearReturn as number,
        threeYearCagr: fund.threeYearCagr as number,
        currentAumBn: Math.max(fund.currentAumBn ?? 0.2, 0.2),
      }))
      .sort((a, b) => b.currentAumBn - a.currentAumBn)

    return eligible.slice(0, 24)
  }, [filteredFunds])

  const returnsSeries = useMemo(() => {
    const sortedByAum = [...filteredFunds].sort(
      (a, b) => (b.currentAumBn ?? 0) - (a.currentAumBn ?? 0),
    )
    return sortedByAum.slice(0, 12)
  }, [filteredFunds])

  const tableData = useMemo(
    () =>
      [...filteredFunds].sort(
        (a, b) => (b.currentAumBn ?? 0) - (a.currentAumBn ?? 0),
      ),
    [filteredFunds],
  )

  const topAumDetailRows = useMemo(
    () =>
      tableData.slice(0, 4).map((fund) => ({
        fund: fund.fund,
        manager: fund.manager ?? 'n/a',
        currentAumBn: fund.currentAumBn ?? null,
      })),
    [tableData],
  )

  const navSnapshots = useMemo<NavSnapshot[]>(() => {
    return navSeries
      .map<NavSnapshot | null>((series) => {
        if (!series.points.length) return null
        const meaningfulPoint = [...series.points]
          .slice()
          .reverse()
          .find(
            (point) =>
              point.navTotal !== null ||
              point.navPerUnit !== null ||
              point.salePrice !== null ||
              point.repurchasePrice !== null,
          )
        const latest = meaningfulPoint ?? series.points[series.points.length - 1]
        const snapshot: NavSnapshot = {
          fundId: series.fundId,
          label: series.label,
          navTotal: latest.navTotal,
          navTotalBn: latest.navTotal !== null ? latest.navTotal / 1_000_000_000 : null,
          navPerUnit: latest.navPerUnit,
          salePrice: latest.salePrice,
          repurchasePrice: latest.repurchasePrice,
          lastUpdated: latest.date || null,
          collectedAt: latest.collectedAt ?? null,
        }
        return snapshot
      })
      .filter((snapshot): snapshot is NavSnapshot => snapshot !== null)
  }, [navSeries])

  const navSnapshotTiles = useMemo(() => {
    return [...navSnapshots]
      .sort((a, b) => (b.navTotal ?? 0) - (a.navTotal ?? 0))
      .slice(0, 3)
  }, [navSnapshots])

  const navTrendSeries = useMemo(() => {
    const ranked = navSeries
      .map((series) => ({
        ...series,
        latestNavTotal: series.points.length
          ? series.points[series.points.length - 1].navTotal ?? 0
          : 0,
      }))
      .filter((series) => series.points.some((point) => point.navPerUnit !== null))
      .sort((a, b) => (b.latestNavTotal ?? 0) - (a.latestNavTotal ?? 0))
      .slice(0, 5)

    return ranked.map(({ latestNavTotal, ...rest }) => rest)
  }, [navSeries])

  const navPriceSnapshots = useMemo(() => {
    return [...navSnapshots]
      .filter((snapshot) => snapshot.salePrice !== null || snapshot.repurchasePrice !== null)
      .sort(
        (a, b) =>
          (b.salePrice ?? b.navPerUnit ?? 0) -
          (a.salePrice ?? a.navPerUnit ?? 0),
      )
      .slice(0, 6)
  }, [navSnapshots])

  const latestNavUpdate = useMemo(() => {
    let latest: string | null = null
    navSnapshots.forEach((snapshot) => {
      if (!snapshot.lastUpdated) return
      if (!latest || new Date(snapshot.lastUpdated).getTime() > new Date(latest).getTime()) {
        latest = snapshot.lastUpdated
      }
    })
    return latest
  }, [navSnapshots])

  const showContent = !fundsLoading && !error

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>Tanzania CIS Dashboard</h1>
          <p className="dashboard__subtitle">
            Monitoring Assets Under Management and fund performance for Tanzania&apos;s
            Collective Investment Schemes (CIS).
          </p>
        </div>
        <div className="dashboard__meta">
          <span>
            Data source:{' '}
            <a href={FUNDS_CSV_URL} target="_blank" rel="noreferrer">
              Google Sheets (public CSV)
            </a>
          </span>
          {lastRefreshed ? (
            <span>Last refreshed: {lastRefreshed.toLocaleString()}</span>
          ) : null}
        </div>
      </header>

      <section className="dashboard__filters">
        <ManagerFilter
          managers={managerOptions}
          selectedManager={selectedManager}
          onChange={setSelectedManager}
        />
      </section>

      {fundsLoading ? <Loader message="Loading fund data…" /> : null}

      {error ? (
        <div className="dashboard__state dashboard__state--error">
          Unable to load fund data: {error}
        </div>
      ) : null}

      {showContent ? (
        <>
          <section className="metrics-grid">
            <MetricCard
              title="Total AUM"
              value={summaryMetrics.totalAum}
              detailContent={
                topAumDetailRows.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Fund</th>
                        <th>Manager</th>
                        <th style={{ textAlign: 'right' }}>AUM (TZS bn)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAumDetailRows.map((row) => (
                        <tr key={row.fund}>
                          <td>{row.fund}</td>
                          <td>{row.manager}</td>
                          <td style={{ textAlign: 'right' }}>
                            {row.currentAumBn === null
                              ? 'n/a'
                              : row.currentAumBn.toLocaleString('en-US', {
                                  maximumFractionDigits: row.currentAumBn < 10 ? 2 : 1,
                                })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : undefined
              }
            />
            <MetricCard title="Tracked funds" value={summaryMetrics.fundCount} />
            <MetricCard title="Average 1-year return" value={summaryMetrics.averageOneYearReturn} />
            <MetricCard
              title="Average 3-year CAGR"
              value={summaryMetrics.averageThreeYearCagr}
            />
          </section>

          <section className="charts-grid">
            <Suspense fallback={<ChartFallback title="AUM by Manager" helper="TZS billions" />}>
              <ManagerAumChart data={managerAggregates} />
            </Suspense>
            <Suspense fallback={<ChartFallback title="Total Return by Fund" helper="1-year bar · 3-year CAGR line" />}>
              <ReturnsChart data={returnsSeries} />
            </Suspense>
          </section>

          <section className="charts-grid insights-grid">
            <Suspense fallback={<ChartFallback title="AUM concentration" helper="Top managers" />}>
              <AumBreakdownChart data={aumBreakdownData} />
            </Suspense>
            <Suspense fallback={<ChartFallback title="Return landscape" helper="Scatter" />}>
              <PerformanceScatterPlot data={performanceScatterData} />
            </Suspense>
          </section>

          {(navSnapshotTiles.length || navTrendSeries.length || navError || navLoading) && (
            <section className="nav-section">
              <div className="nav-section__header">
                <div>
                  <h2>NAV intelligence</h2>
                  <p>Daily fund NAV feed parsed into highlights, price spreads, and trends.</p>
                </div>
                <div className="nav-section__status">
                  {navError ? (
                    <span className="nav-section__status--error">
                      Unable to load NAV feed: {navError}
                    </span>
                  ) : navLoading ? (
                    <span>Syncing NAV history…</span>
                  ) : latestNavUpdate ? (
                    <span>
                      Last NAV update: {' '}
                      {new Date(latestNavUpdate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  ) : (
                    <span>NAV feed ready</span>
                  )}
                </div>
              </div>

              {navSnapshotTiles.length ? (
                <NavSnapshotGrid snapshots={navSnapshotTiles} />
              ) : null}

              <div className="charts-grid nav-charts-grid">
                <Suspense fallback={<ChartFallback title="NAV per unit trend" />}>
                  <NavTrendChart series={navTrendSeries} />
                </Suspense>
                <Suspense fallback={<ChartFallback title="Sale vs repurchase window" />}>
                  <NavPriceSpreadChart snapshots={navPriceSnapshots} />
                </Suspense>
              </div>
            </section>
          )}

          <FundsTable data={tableData} />
        </>
      ) : null}

      <footer className="dashboard__footer">
        <p>
          Tip: Use the manager filter to isolate a manager&apos;s funds and gauge their collective
          AUM, 1-year returns, and longer-term performance.
        </p>
      </footer>
    </div>
  )
}

export default App
