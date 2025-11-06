import type { FundRecord } from '../types'

interface FundsTableProps {
  data: FundRecord[]
}

const formatCurrency = (value: number | null | undefined) =>
  value === null || value === undefined
    ? 'n/a'
    : `${value.toLocaleString('en-US', {
        maximumFractionDigits: value < 10 ? 2 : 1,
        minimumFractionDigits: 0,
      })}`

const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? 'n/a' : `${value.toFixed(1)}%`

const FundsTable = ({ data }: FundsTableProps) => (
  <div className="panel">
    <div className="panel__header">
      <h2>Fund Detail</h2>
      <span className="panel__helper">Sorted by AUM</span>
    </div>
    <div className="funds-table-wrapper">
      <table className="funds-table">
        <thead>
          <tr>
            <th>Fund</th>
            <th>Manager</th>
            <th className="numeric-col">AUM (TZS bn)</th>
            <th className="numeric-col">1-year</th>
            <th className="numeric-col">3-year CAGR</th>
            <th>Structure</th>
            <th>Liquidity</th>
          </tr>
        </thead>
        <tbody>
          {data.map((fund) => (
            <tr key={fund.fund}>
              <td>
                {fund.fundLink ? (
                  <a href={fund.fundLink} target="_blank" rel="noreferrer">
                    {fund.fund}
                  </a>
                ) : (
                  fund.fund
                )}
              </td>
              <td>
                {fund.managerLink ? (
                  <a href={fund.managerLink} target="_blank" rel="noreferrer">
                    {fund.manager ?? 'n/a'}
                  </a>
                ) : (
                  fund.manager ?? 'n/a'
                )}
              </td>
              <td className="numeric-col">{formatCurrency(fund.currentAumBn)}</td>
              <td className="numeric-col">{formatPercent(fund.oneYearReturn)}</td>
              <td className="numeric-col">{formatPercent(fund.threeYearCagr)}</td>
              <td>{fund.structure ?? 'n/a'}</td>
              <td>{fund.liquidityWindow ?? 'n/a'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

export default FundsTable
