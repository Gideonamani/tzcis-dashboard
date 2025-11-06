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
