import { useEffect, useMemo, useState } from 'react'
import './App.css'
import MetricCard from './components/MetricCard'
import ManagerAumChart from './components/ManagerAumChart'
import ReturnsChart from './components/ReturnsChart'
import FundsTable from './components/FundsTable'
import ManagerFilter from './components/ManagerFilter'
import { aggregateByManager, fetchFundData, FUNDS_CSV_URL } from './services/fundData'
import type { FundRecord } from './types'

function App() {
  const [funds, setFunds] = useState<FundRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedManager, setSelectedManager] = useState('all')
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  useEffect(() => {
    let ignore = false

    const load = async () => {
      try {
        setLoading(true)
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
          setLoading(false)
        }
      }
    }

    load()

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

  const showContent = !loading && !error

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

      {loading ? (
        <div className="dashboard__state">Loading fund data…</div>
      ) : null}

      {error ? (
        <div className="dashboard__state dashboard__state--error">
          Unable to load fund data: {error}
        </div>
      ) : null}

      {showContent ? (
        <>
          <section className="metrics-grid">
            <MetricCard title="Total AUM" value={summaryMetrics.totalAum} />
            <MetricCard title="Tracked funds" value={summaryMetrics.fundCount} />
            <MetricCard title="Average 1-year return" value={summaryMetrics.averageOneYearReturn} />
            <MetricCard
              title="Average 3-year CAGR"
              value={summaryMetrics.averageThreeYearCagr}
            />
          </section>

          <section className="charts-grid">
            <ManagerAumChart data={managerAggregates} />
            <ReturnsChart data={returnsSeries} />
          </section>

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
