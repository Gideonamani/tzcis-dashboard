import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { NavSnapshot } from '../types'

interface NavPriceSpreadChartProps {
  snapshots: NavSnapshot[]
}

const formatPrice = (value: number | null | undefined) =>
  value === null || value === undefined
    ? 'n/a'
    : `TZS ${value.toLocaleString('en-US', {
        maximumFractionDigits: value < 100 ? 2 : value < 1000 ? 1 : 0,
      })}`

const LABELS: Record<string, string> = {
  salePrice: 'Sale price',
  repurchasePrice: 'Repurchase price',
  navPerUnit: 'NAV / unit',
}

const NavPriceSpreadChart = ({ snapshots }: NavPriceSpreadChartProps) => {
  const data = snapshots
    .filter((snapshot) => snapshot.salePrice !== null || snapshot.repurchasePrice !== null)
    .map((snapshot) => ({
      label: snapshot.label,
      salePrice: snapshot.salePrice,
      repurchasePrice: snapshot.repurchasePrice,
      navPerUnit: snapshot.navPerUnit,
    }))

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Sale vs repurchase window</h2>
        <span className="panel__helper">Latest published prices per fund</span>
      </div>
      {data.length ? (
        <div className="panel__chart">
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart data={data} layout="vertical" margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={formatPrice} domain={['auto', 'auto']} />
              <YAxis dataKey="label" type="category" width={140} />
              <Tooltip
                formatter={(value: number | string, key: string) => [
                  typeof value === 'number' ? formatPrice(value) : 'n/a',
                  LABELS[key] ?? key,
                ]}
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar
                dataKey="salePrice"
                name="Sale price"
                fill="#0ea5e9"
                radius={[6, 6, 6, 6]}
                barSize={16}
              />
              <Bar
                dataKey="repurchasePrice"
                name="Repurchase price"
                fill="#2563eb"
                radius={[6, 6, 6, 6]}
                barSize={16}
              />
              <Line
                type="monotone"
                dataKey="navPerUnit"
                name="NAV / unit"
                stroke="#0f172a"
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="panel__empty">Price spreads will display once NAV data loads.</div>
      )}
    </div>
  )
}

export default NavPriceSpreadChart
