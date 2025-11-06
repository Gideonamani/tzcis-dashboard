import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import type { ManagerAggregate } from '../types'

interface ManagerAumChartProps {
  data: ManagerAggregate[]
}

const formatBn = (value: number) => `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} bn`

const ManagerAumChart = ({ data }: ManagerAumChartProps) => (
  <div className="panel">
    <div className="panel__header">
      <h2>AUM by Manager</h2>
      <span className="panel__helper">TZS billions</span>
    </div>
    <div className="panel__chart">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart data={data} margin={{ top: 16, right: 16, bottom: 32, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="manager"
            angle={-25}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12 }}
            interval={0}
          />
          <YAxis
            tickFormatter={(value) => `${value}`}
            tick={{ fontSize: 12 }}
            width={80}
            label={{ value: 'TZS bn', angle: -90, position: 'insideLeft', offset: 10 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(59,130,246,0.08)' }}
            formatter={(value: number) => [formatBn(value), 'Current AUM']}
          />
          <Bar dataKey="totalAumBn" fill="#2563eb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
)

export default ManagerAumChart
