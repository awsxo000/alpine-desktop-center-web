import type { BridgeHealth, DependencyStatus, DiagnosticCheck, DiagnosticCheckStatus, DiagnosticStatus, LogEntry, Module, ModuleDiagnostic, ModuleId, ModuleState, NamedOperation } from './types'

export const initialLogs: LogEntry[] = [
  { time: '--:--:--', level: 'info', text: 'Waiting for the local bridge.' },
]

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const operationStatuses = new Set(['running', 'success', 'error', 'blocked'])
const knownModuleIds = new Set<ModuleId>(['base', 'audio', 'energia', 'fontes', 'kde', 'bluetooth', 'rede', 'nix', 'nix_opengl', 'steam', 'swap'])
const moduleStates = new Set<ModuleState>(['Ready', 'Needs attention', 'Not detected', 'Unknown'])
const moduleStatuses = new Set<DiagnosticStatus>(['complete', 'partial', 'incomplete', 'unknown'])
const checkStatuses = new Set<DiagnosticCheckStatus>(['ok', 'warning', 'error', 'unknown'])
const dependencyStatuses = new Set<DependencyStatus>(['not_checked', ...moduleStatuses])
const summaryFields = ['passed', 'failed', 'warnings', 'unknown', 'total', 'required_total'] as const

const isModuleId = (value: unknown): value is ModuleId => typeof value === 'string' && knownModuleIds.has(value as ModuleId)
const isModuleState = (value: unknown): value is ModuleState => typeof value === 'string' && moduleStates.has(value as ModuleState)
const isDiagnosticStatus = (value: unknown): value is DiagnosticStatus => typeof value === 'string' && moduleStatuses.has(value as DiagnosticStatus)
const isDependencyStatus = (value: unknown): value is DependencyStatus => typeof value === 'string' && dependencyStatuses.has(value as DependencyStatus)
const isCheckStatus = (value: unknown): value is DiagnosticCheckStatus => typeof value === 'string' && checkStatuses.has(value as DiagnosticCheckStatus)

function parseDiagnostic(value: unknown): ModuleDiagnostic {
  if (!isRecord(value) || value.schema_version !== 1 || !isModuleId(value.module) || typeof value.checked_at !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value.checked_at) || !Number.isFinite(Date.parse(value.checked_at)) || !isDiagnosticStatus(value.status)) {
    throw new Error('The backend returned an unsupported diagnostic schema.')
  }
  const summaryValue = value.summary
  if (!isRecord(summaryValue)) {
    throw new Error('The backend returned an invalid diagnostic summary.')
  }
  const summary = summaryValue
  if (summaryFields.some((field) => {
    const count = summary[field]
    return typeof count !== 'number' || !Number.isInteger(count) || count < 0
  })) {
    throw new Error('The backend returned an invalid diagnostic summary.')
  }
  const total = summary.total as number
  if ((summary.required_total as number) > total || summaryFields.slice(0, 4).reduce((sum, field) => sum + Number(summary[field]), 0) !== total) {
    throw new Error('The backend diagnostic summary contains inconsistent counts.')
  }
  if (!Array.isArray(value.checks) || value.checks.length !== total || !value.checks.every((check): check is DiagnosticCheck => {
    if (!isRecord(check)) return false
    return ['id', 'title', 'description', 'message'].every((field) => typeof check[field] === 'string')
      && isCheckStatus(check.status)
      && typeof check.required === 'boolean'
  })) {
    throw new Error('The backend returned invalid diagnostic checks.')
  }
  if (!Array.isArray(value.dependencies) || !value.dependencies.every((dependency) => isRecord(dependency)
    && isModuleId(dependency.module)
    && isDependencyStatus(dependency.status))) {
    throw new Error('The backend returned invalid diagnostic dependencies.')
  }
  const dependencyIds = value.dependencies.map((dependency) => (dependency as Record<string, unknown>).module as string)
  if (dependencyIds.includes(value.module) || new Set(dependencyIds).size !== dependencyIds.length) {
    throw new Error('The backend returned duplicate or self-referential diagnostic dependencies.')
  }
  return value as unknown as ModuleDiagnostic
}

export async function localApi(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  return fetch(path, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
}

const endpointFor: Record<NamedOperation, string> = {
  'validate-backend': '/api/operations/validate-backend',
  'system-check': '/api/operations/system-check',
  'check-all-modules': '/api/operations/check-all-modules',
  'diagnose-module': '/api/operations/diagnose-module',
  'simulate-full': '/api/operations/simulate-full',
  'apply-full': '/api/operations/apply-full',
  'apply-diagnostics': '/api/operations/apply-diagnostics',
  'refresh-nix-apps': '/api/operations/refresh-nix-apps',
  'check-stable-channel': '/api/operations/check-stable-channel',
  'migrate-stable-channel': '/api/operations/migrate-stable-channel',
  'apply-module': '/api/operations/apply-module',
}

export async function startNamedOperation(operation: NamedOperation, parameters: Record<string, string> = {}): Promise<Response> {
  return localApi(endpointFor[operation], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...parameters }),
  })
}

export type OperationUpdate = {
  session_id: string
  status: 'running' | 'success' | 'error' | 'blocked'
  message: string
  return_code: number | null
  output: string
  next_cursor: number
  results?: ModuleDiagnostic[]
  log_path?: string | null
}

export async function getOperationUpdate(sessionId: string, cursor = 0): Promise<OperationUpdate> {
  const response = await localApi(`/api/operations/${encodeURIComponent(sessionId)}?cursor=${cursor}`)
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || typeof value.session_id !== 'string' || typeof value.status !== 'string' || !operationStatuses.has(value.status) || typeof value.message !== 'string' || (value.return_code !== null && !Number.isInteger(value.return_code)) || typeof value.output !== 'string' || !Number.isInteger(value.next_cursor) || Number(value.next_cursor) < 0 || (value.log_path !== undefined && value.log_path !== null && typeof value.log_path !== 'string') || (value.results !== undefined && !Array.isArray(value.results))) {
    throw new Error(isRecord(value) && typeof value.message === 'string' ? value.message : 'Could not read the operation session.')
  }
  const results = value.results === undefined ? undefined : value.results.map(parseDiagnostic)
  return { ...value, results } as OperationUpdate
}

export async function getBridgeHealth(): Promise<BridgeHealth> {
  const response = await localApi('/api/health')
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || value.bridge !== 'local' || (value.backend !== 'validated' && value.backend !== 'failed') || typeof value.message !== 'string' || typeof value.release_root !== 'string' || typeof value.frontend_version !== 'string' || typeof value.backend_version !== 'string' || typeof value.backend_commit !== 'string' || typeof value.diagnostic_schema !== 'string') {
    throw new Error(isRecord(value) && typeof value.message === 'string' ? value.message : 'Backend validation failed.')
  }
  return value as unknown as BridgeHealth
}

export async function getModuleCatalog(): Promise<Module[]> {
  const response = await localApi('/api/modules')
  const payload = await response.json().catch(() => null) as { modules?: unknown } | null
  if (!response.ok || !payload || !Array.isArray(payload.modules)) {
    throw new Error('Could not load the module catalog.')
  }
  return payload.modules.map((candidate): Module => {
    if (!candidate || typeof candidate !== 'object') throw new Error('The module catalog contains an invalid entry.')
    const item = candidate as Record<string, unknown>
    if (!isModuleId(item.id) || typeof item.name !== 'string' || typeof item.description !== 'string' || typeof item.detail !== 'string' || typeof item.accent !== 'string' || !isModuleState(item.state)) {
      throw new Error('The module catalog does not match the supported schema.')
    }
    if (!Array.isArray(item.dependencies) || !item.dependencies.every(isModuleId)) {
      throw new Error('The module catalog contains invalid dependencies.')
    }
    const dependencies = item.dependencies as ModuleId[]
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      detail: item.detail,
      accent: item.accent,
      state: item.state,
      dependencies,
    }
  })
}
