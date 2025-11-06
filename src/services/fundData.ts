import Papa from 'papaparse'
import type { FundRecord, ManagerAggregate } from '../types'

export const FUNDS_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vShsrgZoT3OwRgNwBm9NHLKZ5JnEURvir5A_guJRw07aDlIDRwYLOG0DJZRjZQXEBqkdLCaf7ItjYEO/pub?gid=0&single=true&output=csv'

const sanitizeString = (value: string | undefined): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const parseNumber = (value: string | undefined): number | null => {
  const source = sanitizeString(value)
  if (!source) return null
  const cleaned = source.replace(/[, ]+/g, '')
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

const parsePercent = (value: string | undefined): number | null => {
  const sanitized = sanitizeString(value)
  if (!sanitized) return null
  const stripped = sanitized.replace(/%/g, '')
  const parsed = parseNumber(stripped)
  return parsed === null ? null : parsed
}

const parseLaunchYear = (value: string | undefined): number | null => {
  const parsed = parseNumber(value)
  if (parsed === null) return null
  const year = Math.trunc(parsed)
  return year >= 1900 && year <= 2100 ? year : null
}

const mapRowToFund = (row: Record<string, string>): FundRecord | null => {
  const fundName = sanitizeString(row['Fund'])
  if (!fundName) return null

  return {
    fund: fundName,
    fundLink: sanitizeString(row['Fund Link']),
    launchYear: parseLaunchYear(row['Launch Year']),
    currentAumBn: parseNumber(row['Current AUM (TZS bn)']),
    navPerUnit: parseNumber(row['NAV/Unit']),
    oneYearReturn: parsePercent(row['1-yr Total Return']),
    threeYearCagr: parsePercent(row['3-yr CAGR']),
    structure: sanitizeString(row['Structure']),
    manager: sanitizeString(row['Manager']),
    managerLink: sanitizeString(row['Manager Link']),
    trusteeCustodian: sanitizeString(row['Trustee/Custodian']),
    assetClassTilt: sanitizeString(row['Asset Class Tilt']),
    benchmark: sanitizeString(row['Benchmark']),
    liquidityWindow: sanitizeString(row['Liquidity Window']),
    managementFee: sanitizeString(row['Management Fee']),
    frontExitLoad: sanitizeString(row['Front/Exit Load']),
    esgPolicy: sanitizeString(row['ESG Policy']),
    notes: sanitizeString(row['Notes']),
  }
}

export const fetchFundData = async (): Promise<FundRecord[]> => {
  const response = await fetch(FUNDS_CSV_URL)
  if (!response.ok) {
    throw new Error(`Failed to fetch fund data (${response.status})`)
  }

  const csvText = await response.text()
  const { data } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })

  return data
    .map((row) => mapRowToFund(row))
    .filter((record): record is FundRecord => Boolean(record))
}

export const aggregateByManager = (funds: FundRecord[]): ManagerAggregate[] => {
  type AggregateAccumulator = {
    manager: string
    totalAumBn: number
    fundCount: number
    returnSum: number
    returnCount: number
  }

  const aggregates = new Map<string, AggregateAccumulator>()

  funds.forEach((fund) => {
    const manager = fund.manager
    if (!manager) return

    const entry = aggregates.get(manager)
    const aum = fund.currentAumBn ?? 0
    const oneYearReturn = fund.oneYearReturn

    if (!entry) {
      aggregates.set(manager, {
        manager,
        totalAumBn: aum,
        fundCount: 1,
        returnSum: oneYearReturn ?? 0,
        returnCount: oneYearReturn === null || oneYearReturn === undefined ? 0 : 1,
      })
      return
    }

    entry.totalAumBn += aum
    entry.fundCount += 1
    if (oneYearReturn !== null && oneYearReturn !== undefined) {
      entry.returnSum += oneYearReturn
      entry.returnCount += 1
    }
  })

  return Array.from(aggregates.values())
    .map<ManagerAggregate>((entry) => ({
      manager: entry.manager,
      totalAumBn: entry.totalAumBn,
      fundCount: entry.fundCount,
      averageOneYearReturn: entry.returnCount ? entry.returnSum / entry.returnCount : null,
    }))
    .sort((a, b) => b.totalAumBn - a.totalAumBn)
}
