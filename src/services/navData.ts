import Papa from 'papaparse'
import type { FundNavPoint, FundNavSeries, FundNavSeriesMeta } from '../types'

export const NAV_SHEET_BASE_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIofEtKwOzMHLpimKZtaiSME-ZttNVEwpP0fuvoV8pQ0s7nKWlZI66LfBVYiR_60g-8rJcEWOP2Foo/pub'

export const NAV_SHEET_META: FundNavSeriesMeta[] = [
  { fundId: 'utt.jikimu', label: 'UTT Jikimu', gid: '300145793', color: '#2563eb' },
  { fundId: 'utt.bond', label: 'UTT Bond', gid: '973772617', color: '#0ea5e9' },
  { fundId: 'utt.umoja', label: 'UTT Umoja', gid: '1675532771', color: '#f97316' },
  { fundId: 'utt.watoto', label: 'UTT Watoto', gid: '1356664283', color: '#10b981' },
  { fundId: 'utt.liquid', label: 'UTT Liquid', gid: '1546354821', color: '#8b5cf6' },
  { fundId: 'utt.wekeza', label: 'UTT Wekeza', gid: '2144972633', color: '#ef4444' },
  { fundId: 'whi.faida', label: 'WHI Faida', gid: '1121852789', color: '#14b8a6' },
  { fundId: 'itrust.iSave', label: 'iTrust iSave', gid: '1557232385', color: '#facc15' },
  { fundId: 'itrust.iGrowth', label: 'iTrust iGrowth', gid: '369007501', color: '#06b6d4' },
  { fundId: 'itrust.icash', label: 'iTrust iCash', gid: '803337082', color: '#7c3aed' },
  { fundId: 'itrust.income', label: 'iTrust Income', gid: '2034209257', color: '#f43f5e' },
  { fundId: 'itrust.Imaan', label: 'iTrust Imaan', gid: '1696390802', color: '#a855f7' },
  { fundId: 'itrust.iDollar', label: 'iTrust iDollar', gid: '391980713', color: '#0f172a' },
  { fundId: 'zansec.timiza', label: 'ZanSec Timiza', gid: '97362708', color: '#22c55e' },
  { fundId: 'orbit.inuka', label: 'Orbit Inuka', gid: '362392477', color: '#ea580c' },
]

const parseNumber = (value: string | undefined): number | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.length) return null
  const cleaned = trimmed.replace(/[,\s]/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const mapRowToNavPoint = (row: Record<string, string>, fundId: string): FundNavPoint | null => {
  const date = row['date']?.trim()
  if (!date) return null

  return {
    fundId,
    date,
    navTotal: parseNumber(row['nav_total']),
    unitsOutstanding: parseNumber(row['units_outstanding']),
    navPerUnit: parseNumber(row['nav_per_unit']),
    salePrice: parseNumber(row['sale_price']),
    repurchasePrice: parseNumber(row['repurchase_price']),
    sourceUrl: row['source_url']?.trim() || undefined,
    collectedAt: row['collected_at']?.trim() || undefined,
  }
}

const buildSheetUrl = (gid: string) => `${NAV_SHEET_BASE_URL}?gid=${gid}&single=true&output=csv`

export const fetchNavSeries = async (): Promise<FundNavSeries[]> => {
  const series = await Promise.all(
    NAV_SHEET_META.map(async (meta) => {
      const response = await fetch(buildSheetUrl(meta.gid))
      if (!response.ok) {
        throw new Error(`Failed to fetch NAV data for ${meta.fundId} (${response.status})`)
      }

      const csvText = await response.text()
      const { data } = Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
      })

      const points = data
        .map((row) => mapRowToNavPoint(row, meta.fundId))
        .filter((point): point is FundNavPoint => Boolean(point))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      return {
        ...meta,
        points,
      }
    }),
  )

  return series
}
