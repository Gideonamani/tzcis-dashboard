export interface FundRecord {
  fund: string
  fundLink?: string
  launchYear?: number | null
  currentAumBn?: number | null
  navPerUnit?: number | null
  oneYearReturn?: number | null
  threeYearCagr?: number | null
  structure?: string
  manager?: string
  managerLink?: string
  trusteeCustodian?: string
  assetClassTilt?: string
  benchmark?: string
  liquidityWindow?: string
  managementFee?: string
  frontExitLoad?: string
  esgPolicy?: string
  notes?: string
}

export interface ManagerAggregate {
  manager: string
  totalAumBn: number
  averageOneYearReturn: number | null
  fundCount: number
}

export interface FundNavPoint {
  fundId: string
  date: string
  navTotal: number | null
  unitsOutstanding: number | null
  navPerUnit: number | null
  salePrice: number | null
  repurchasePrice: number | null
  sourceUrl?: string
  collectedAt?: string
}

export interface FundNavSeriesMeta {
  fundId: string
  label: string
  gid: string
  color: string
}

export interface FundNavSeries extends FundNavSeriesMeta {
  points: FundNavPoint[]
}

export interface NavSnapshot {
  fundId: string
  label: string
  navTotal: number | null
  navTotalBn: number | null
  navPerUnit: number | null
  salePrice: number | null
  repurchasePrice: number | null
  lastUpdated: string | null
  collectedAt?: string | null
}
