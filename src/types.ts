export type StepId = 'welcome' | 'verify' | 'apply' | 'nix' | 'history'

export type OperationState = 'idle' | 'running' | 'waiting' | 'success' | 'error' | 'blocked'

export type ModuleId = 'base' | 'audio' | 'energia' | 'fontes' | 'kde' | 'bluetooth' | 'rede' | 'nix' | 'nix_opengl' | 'steam' | 'swap'
export type ModuleState = 'Ready' | 'Needs attention' | 'Not detected' | 'Unknown'
export type DiagnosticStatus = 'complete' | 'partial' | 'incomplete' | 'unknown'
export type DependencyStatus = 'not_checked' | DiagnosticStatus
export type DiagnosticCheckStatus = 'ok' | 'warning' | 'error' | 'unknown'

export type Module = {
  id: ModuleId
  name: string
  description: string
  state: ModuleState
  detail: string
  accent: string
  dependencies?: ModuleId[]
}

export type DiagnosticCheck = {
  id: string
  title: string
  description: string
  status: DiagnosticCheckStatus
  required: boolean
  message: string
}

export type ModuleDiagnostic = {
  schema_version: 1
  module: ModuleId
  checked_at: string
  status: DiagnosticStatus
  summary: {
    passed: number
    failed: number
    warnings: number
    unknown: number
    total: number
    required_total: number
  }
  dependencies: Array<{ module: ModuleId; status: DependencyStatus }>
  checks: DiagnosticCheck[]
}

export type LogEntry = {
  time: string
  level: 'info' | 'success' | 'warning' | 'error'
  text: string
}

export type NamedOperation =
  | 'validate-backend'
  | 'system-check'
  | 'check-all-modules'
  | 'diagnose-module'
  | 'simulate-full'
  | 'apply-full'
  | 'apply-diagnostics'
  | 'refresh-nix-apps'
  | 'update-nix-apps'
  | 'refresh-kde-apps'
  | 'check-stable-channel'
  | 'migrate-stable-channel'
  | 'apply-module'

export type BridgeHealth = {
  bridge: 'local' | 'unknown'
  backend: 'validated' | 'failed'
  message: string
  release_root: string
  frontend_version: string
  backend_version: string
  backend_commit: string
  diagnostic_schema: string
}

export type OperationLogStatus = 'success' | 'error' | 'blocked' | 'running' | 'unknown'

export type OperationLogSummary = {
  id: string
  path: string
  modified: number
  operation: NamedOperation
  module: ModuleId | null
  label: string
  status: OperationLogStatus
  started_at: string | null
}

export type SavedOperationLog = OperationLogSummary & { content: string }

export type StableChannelReport = {
  status: 'current' | 'update_available' | 'unknown'
  current_version?: string
  latest_version?: string
  latest_channel?: string
  source?: string
  message?: string
}

export type PersistedStableChannelStatus = {
  checked: boolean
  status: OperationLogStatus | 'not_checked'
  report: StableChannelReport | null
  checked_at: string | null
  log_id: string | null
  log_path: string | null
  message: string
}
