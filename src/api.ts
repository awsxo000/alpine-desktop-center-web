import type { BridgeHealth, DesktopEnvironment, DesktopEnvironmentId, DependencyStatus, DiagnosticCheck, DiagnosticCheckStatus, DiagnosticStatus, LogEntry, Module, ModuleDiagnostic, ModuleId, ModuleState, NamedOperation, NixSupport, OperationLogSummary, PersistedStableChannelStatus, SavedOperationLog } from './types'

export const initialLogs: LogEntry[] = [
  { time: '--:--:--', level: 'info', text: 'Waiting for the local bridge.' },
]

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const operationStatuses = new Set(['running', 'success', 'error', 'blocked'])
const knownModuleIds = new Set<ModuleId>(['base', 'audio', 'energia', 'fontes', 'kde', 'bluetooth', 'rede', 'nix', 'nix_opengl', 'steam', 'swap'])
const knownDesktopIds = new Set<DesktopEnvironmentId>(['kde', 'gnome', 'xfce', 'mate', 'lxqt', 'cinnamon', 'budgie', 'unknown'])
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
  'update-nix-apps': '/api/operations/update-nix-apps',
  'list-nix-apps': '/api/operations/list-nix-apps',
  'uninstall-nix-app': '/api/operations/uninstall-nix-app',
  'collect-nix-garbage': '/api/operations/collect-nix-garbage',
  'refresh-kde-apps': '/api/operations/refresh-kde-apps',
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
  nix_apps?: import('./types').NixApp[]
  log_path?: string | null
}

export async function getOperationUpdate(sessionId: string, cursor = 0): Promise<OperationUpdate> {
  const response = await localApi(`/api/operations/${encodeURIComponent(sessionId)}?cursor=${cursor}`)
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || typeof value.session_id !== 'string' || typeof value.status !== 'string' || !operationStatuses.has(value.status) || typeof value.message !== 'string' || (value.return_code !== null && !Number.isInteger(value.return_code)) || typeof value.output !== 'string' || !Number.isInteger(value.next_cursor) || Number(value.next_cursor) < 0 || (value.log_path !== undefined && value.log_path !== null && typeof value.log_path !== 'string') || (value.results !== undefined && !Array.isArray(value.results)) || (value.nix_apps !== undefined && !Array.isArray(value.nix_apps))) {
    throw new Error(isRecord(value) && typeof value.message === 'string' ? value.message : 'Could not read the operation session.')
  }
  const results = value.results === undefined ? undefined : value.results.map(parseDiagnostic)
  const nix_apps = value.nix_apps === undefined ? undefined : value.nix_apps.map((app) => {
    if (!isRecord(app) || typeof app.index !== 'number' || !Number.isInteger(app.index) || app.index < 1 || typeof app.name !== 'string' || (app.attrPath !== null && typeof app.attrPath !== 'string') || typeof app.active !== 'boolean' || !Array.isArray(app.storePaths) || !app.storePaths.every((path) => typeof path === 'string')) {
      throw new Error('The backend returned an invalid Nix application list.')
    }
    return app as import('./types').NixApp
  })
  return { ...value, results, nix_apps } as OperationUpdate
}


export async function getDesktopEnvironment(): Promise<DesktopEnvironment> {
  const response = await localApi('/api/environment')
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.session_type !== 'string' || typeof value.detection_source !== 'string' || !Array.isArray(value.capabilities) || !value.capabilities.every((item) => typeof item === 'string')) {
    throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : 'Could not detect the desktop environment.')
  }
  return { id: value.id as DesktopEnvironment['id'], name: value.name, sessionType: value.session_type, detectionSource: value.detection_source, capabilities: value.capabilities }
}

export async function getNixSupport(): Promise<NixSupport> {
  const response = await localApi('/api/nix/status')
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || typeof value.supported !== 'boolean' || typeof value.nix_env !== 'boolean' || typeof value.stable_channel !== 'boolean' || (value.version !== null && typeof value.version !== 'string') || (value.reason !== null && typeof value.reason !== 'string')) {
    throw new Error('The Nix support response does not match the supported schema.')
  }
  return { supported: value.supported, nixEnv: value.nix_env, stableChannel: value.stable_channel, version: value.version, reason: value.reason }
}

export async function getBridgeHealth(): Promise<BridgeHealth> {
  const response = await localApi('/api/health')
  const value = await response.json().catch(() => null) as unknown
  if ((!response.ok && response.status !== 503) || !isRecord(value) || value.bridge !== 'local' || (value.backend !== 'validated' && value.backend !== 'failed') || typeof value.message !== 'string' || typeof value.release_root !== 'string' || typeof value.frontend_version !== 'string' || typeof value.backend_version !== 'string' || typeof value.backend_commit !== 'string' || typeof value.diagnostic_schema !== 'string') {
    throw new Error(isRecord(value) && typeof value.message === 'string' ? value.message : 'Backend validation failed.')
  }
  return value as unknown as BridgeHealth
}

export async function getOperationHistory(): Promise<OperationLogSummary[]> {
  const response = await localApi('/api/logs')
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || !Array.isArray(value.logs)) {
    throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : 'Could not read operation history.')
  }
  return value.logs.map((entry): OperationLogSummary => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(entry.id) || typeof entry.path !== 'string' || typeof entry.modified !== 'number' || !Number.isFinite(entry.modified) || typeof entry.operation !== 'string' || (entry.module !== null && !isModuleId(entry.module)) || typeof entry.label !== 'string' || !['success', 'error', 'blocked', 'running', 'unknown'].includes(String(entry.status)) || (entry.started_at !== null && typeof entry.started_at !== 'string')) {
      throw new Error('The backend returned an invalid operation-history entry.')
    }
    return entry as unknown as OperationLogSummary
  })
}

export async function getSavedOperationLog(id: string): Promise<SavedOperationLog> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid operation log identifier.')
  const response = await localApi(`/api/logs/${encodeURIComponent(id)}`)
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || typeof value.content !== 'string' || typeof value.id !== 'string' || typeof value.path !== 'string' || typeof value.modified !== 'number' || typeof value.operation !== 'string' || typeof value.label !== 'string' || typeof value.status !== 'string' || (value.module !== null && !isModuleId(value.module)) || (value.started_at !== null && typeof value.started_at !== 'string')) {
    throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : 'Could not read the saved operation log.')
  }
  return value as unknown as SavedOperationLog
}

export async function getPersistedStableChannelStatus(): Promise<PersistedStableChannelStatus> {
  const response = await localApi('/api/stable-channel/status')
  const value = await response.json().catch(() => null) as unknown
  if (!response.ok || !isRecord(value) || typeof value.checked !== 'boolean' || typeof value.status !== 'string' || !['success', 'error', 'blocked', 'running', 'unknown', 'not_checked'].includes(value.status) || typeof value.message !== 'string' || (value.report !== null && !isRecord(value.report)) || (value.checked_at !== null && typeof value.checked_at !== 'string') || (value.log_id !== null && typeof value.log_id !== 'string') || (value.log_path !== null && typeof value.log_path !== 'string')) {
    throw new Error(isRecord(value) && typeof value.error === 'string' ? value.error : 'Could not read the persisted Stable channel status.')
  }
  return value as unknown as PersistedStableChannelStatus
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
    const desktopTargets = item.desktop_targets === undefined ? undefined : item.desktop_targets
    if (desktopTargets !== undefined && (!Array.isArray(desktopTargets) || !desktopTargets.every((target) => typeof target === 'string' && knownDesktopIds.has(target as DesktopEnvironmentId)))) {
      throw new Error('The module catalog contains invalid desktop targets.')
    }
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      detail: item.detail,
      accent: item.accent,
      state: item.state,
      dependencies,
      ...(desktopTargets ? { desktopTargets: desktopTargets as DesktopEnvironmentId[] } : {}),
    }
  })
}
