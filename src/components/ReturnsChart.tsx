import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import type { FundRecord } from '../types'

interface ReturnsChartProps {
  data: Array<
    Pick<
      FundRecord,
      'fund' | 'oneYearReturn' | 'threeYearCagr' | 'currentAumBn' | 'manager'
    >
  >
}

const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'n/a'
  return `${value.toFixed(1)}%`
}

const ReturnsChart = ({ data }: ReturnsChartProps) => (
  <div className="panel">
    <div className="panel__header">
      <h2>Total Return by Fund</h2>
      <span className="panel__helper">1-year bar · 3-year CAGR line</span>
    </div>
    <div className="panel__chart">
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="fund"
            angle={-20}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 12 }}
            width={60}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatPercent(value),
              name === 'oneYearReturn' ? '1-year return' : '3-year CAGR',
            ]}
            labelFormatter={(label, payload) => {
              if (!payload?.length) return label
              const fund = payload[0].payload as FundRecord
              const manager = fund.manager ? ` · ${fund.manager}` : ''
              return `${label}${manager}`
            }}
          />
          <Legend verticalAlign="top" height={36} />
          <Bar
            dataKey="oneYearReturn"
            name="1-year return"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="threeYearCagr"
            name="3-year CAGR"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  </div>
)

export default ReturnsChart
