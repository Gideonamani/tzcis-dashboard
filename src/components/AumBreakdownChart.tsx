import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

export interface AumSlice {
  name: string
  value: number
  percentage: number
  color: string
  [key: string]: string | number
}

interface AumBreakdownChartProps {
  data: AumSlice[]
  height?: number
  onExpand?: () => void
}

const formatBn = (value: number) =>
  `TZS ${value.toLocaleString('en-US', {
    maximumFractionDigits: value < 10 ? 2 : 1,
  })} bn`

const AumBreakdownChart = ({ data, height, onExpand }: AumBreakdownChartProps) => (
  <div className="panel">
    <div className="panel__header panel__header--with-actions">
      <div>
        <h2>AUM concentration</h2>
        <span className="panel__helper">Top managers by share</span>
      </div>
      {onExpand ? (
        <button
          type="button"
          className="panel__action-btn"
          aria-label="Expand AUM concentration chart"
          onClick={onExpand}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M8 4H4v4M20 16v4h-4M4 8l5-5M20 16l-5 5M16 4h4v4M4 16v4h4M16 4l4 4M4 16l4 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
    {data.length ? (
      <div className="panel__chart">
        <ResponsiveContainer width="100%" height={height ?? 360}>
          <PieChart margin={{ top: 20, bottom: 60, left: 0, right: 0 }}>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={4}>
              {data.map((slice) => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props) => [
                formatBn(value),
                `${name} · ${(props.payload as AumSlice).percentage.toFixed(1)}%`,
              ]}
              contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              wrapperStyle={{ paddingTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="panel__empty">Manager share data will appear once funds load.</div>
    )}
  </div>
)

export default AumBreakdownChart
