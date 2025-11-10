import { useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { FundNavSeries } from '../types'

interface NavTrendChartProps {
  series: FundNavSeries[]
}

type ChartDatum = {
  date: string
  [fundId: string]: string | number | null
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

const NavTrendChart = ({ series }: NavTrendChartProps) => {
  const chartData = useMemo(() => {
    const dateMap = new Map<string, ChartDatum>()

    series.forEach((fundSeries) => {
      fundSeries.points.forEach((point) => {
        if (point.navPerUnit === null) return
        const key = point.date
        if (!dateMap.has(key)) {
          dateMap.set(key, { date: key })
        }
        dateMap.get(key)![fundSeries.fundId] = point.navPerUnit
      })
    })

    return Array.from(dateMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )
  }, [series])

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>NAV per unit trend</h2>
        <span className="panel__helper">Latest 5 funds with historical data</span>
      </div>
      {chartData.length ? (
        <div className="panel__chart">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={24} />
              <YAxis
                tickFormatter={(value) =>
                  `TZS ${Number(value).toLocaleString('en-US', {
                    maximumFractionDigits: Number(value) < 100 ? 1 : 0,
                  })}`
                }
                width={90}
              />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                formatter={(value: number | string, fundId) => {
                  const fund = series.find((item) => item.fundId === fundId)
                  const label = fund ? fund.label : fundId
                  if (typeof value !== 'number') {
                    return ['n/a', label]
                  }
                  return [
                    `TZS ${value.toLocaleString('en-US', {
                      maximumFractionDigits: value < 100 ? 2 : 0,
                    })}`,
                    label,
                  ]
                }}
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
              />
              <Legend verticalAlign="top" height={36} />
              {series.map((fundSeries) => (
                <Line
                  key={fundSeries.fundId}
                  type="monotone"
                  dataKey={fundSeries.fundId}
                  name={fundSeries.label}
                  stroke={fundSeries.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="panel__empty">NAV trend data will appear once the feed is loaded.</div>
      )}
    </div>
  )
}

export default NavTrendChart
