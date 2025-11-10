import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

export interface PerformancePoint {
  fund: string
  manager?: string
  oneYearReturn: number
  threeYearCagr: number
  currentAumBn: number
}

interface PerformanceScatterPlotProps {
  data: PerformancePoint[]
}

const formatPercent = (value: number) => `${value.toFixed(1)}%`

const PerformanceScatterPlot = ({ data }: PerformanceScatterPlotProps) => (
  <div className="panel">
    <div className="panel__header">
      <h2>Return landscape</h2>
      <span className="panel__helper">3-yr CAGR vs 1-yr performance</span>
    </div>
    {data.length ? (
      <div className="panel__chart">
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 16, right: 16, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              dataKey="oneYearReturn"
              name="1-year return"
              unit="%"
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis
              type="number"
              dataKey="threeYearCagr"
              name="3-year CAGR"
              unit="%"
              tickFormatter={(value) => `${value}%`}
            />
            <ZAxis dataKey="currentAumBn" range={[60, 220]} name="AUM (TZS bn)" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(value: number, key: string) => {
                if (key === 'currentAumBn') {
                  return [
                    `TZS ${value.toLocaleString('en-US', {
                      maximumFractionDigits: value < 10 ? 2 : 1,
                    })} bn`,
                    'Current AUM',
                  ]
                }
                return [formatPercent(value), key === 'oneYearReturn' ? '1-year return' : '3-year CAGR']
              }}
              labelFormatter={() => ''}
            />
            <Legend verticalAlign="top" height={24} />
            <Scatter data={data} name="Fund" fill="#7c3aed" opacity={0.85} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="panel__empty">Need at least one fund with 1-yr & 3-yr data.</div>
    )}
  </div>
)

export default PerformanceScatterPlot
