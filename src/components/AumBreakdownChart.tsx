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
}

const formatBn = (value: number) =>
  `TZS ${value.toLocaleString('en-US', {
    maximumFractionDigits: value < 10 ? 2 : 1,
  })} bn`

const AumBreakdownChart = ({ data }: AumBreakdownChartProps) => (
  <div className="panel">
    <div className="panel__header">
      <h2>AUM concentration</h2>
      <span className="panel__helper">Top managers by share</span>
    </div>
    {data.length ? (
      <div className="panel__chart">
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
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
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div className="panel__empty">Manager share data will appear once funds load.</div>
    )}
  </div>
)

export default AumBreakdownChart
