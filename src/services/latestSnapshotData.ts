import Papa from 'papaparse'
import type { LatestFundSnapshot } from '../types'

export const LATEST_SNAPSHOT_CSV_URL = import.meta.env.VITE_LATEST_FUNDS_CSV_URL ?? ''

const parseNumber = (value?: string): number | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.length) return null

  const cleaned = trimmed
    .replace(/TZS/gi, '')
    .replace(/[,_\s]/g, '')
    .replace(/\((.*)\)/, '-$1')

  if (!cleaned.length) return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const parseDateValue = (value?: string): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.length) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(trimmed)) {
    const separator = trimmed.includes('/') ? '/' : trimmed.includes('.') ? '.' : '-'
    const [first, second, yearRaw] = trimmed.split(separator)
    const firstNum = Number.parseInt(first, 10)
    const secondNum = Number.parseInt(second, 10)

    const inferredDayFirst = firstNum > 12 && secondNum <= 12
    const month = inferredDayFirst ? secondNum : firstNum
    const day = inferredDayFirst ? firstNum : secondNum
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw.padStart(4, '0')

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

const parseTimestamp = (value?: string): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.length) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

const mapRowToSnapshot = (row: Record<string, string>): LatestFundSnapshot | null => {
  const fundId = row['fund_id']?.trim()
  if (!fundId) return null

  return {
    fundId,
    date: parseDateValue(row['date']),
    navTotal: parseNumber(row['nav_total']),
    unitsOutstanding: parseNumber(row['units_outstanding']),
    navPerUnit: parseNumber(row['nav_per_unit']),
    salePrice: parseNumber(row['sale_price']),
    repurchasePrice: parseNumber(row['repurchase_price']),
    collectedAt: parseTimestamp(row['collected_at']),
  }
}

export const fetchLatestFundSnapshots = async (): Promise<LatestFundSnapshot[]> => {
  if (!LATEST_SNAPSHOT_CSV_URL) {
    throw new Error('Latest fund data CSV URL is not configured (set VITE_LATEST_FUNDS_CSV_URL).')
  }

  const response = await fetch(LATEST_SNAPSHOT_CSV_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch latest fund data (${response.status})`)
  }

  const csvText = await response.text()
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  return data
    .map((row) => mapRowToSnapshot(row))
    .filter((snapshot): snapshot is LatestFundSnapshot => Boolean(snapshot))
}
