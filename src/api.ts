import type { BackendStatus, BridgeHealth, LogEntry, Module, NamedOperation } from './types'

export const backendStatus: BackendStatus = {
  version: 'v1.43',
  frontendVersion: '0.1.0-alpha.5-web',
  integrity: 'validated',
  releasePath: './backend',
  lastValidated: 'Just now',
  operation: 'idle',
  activeOperation: 'Ready for a named operation',
}

export const initialLogs: LogEntry[] = [
  { time: '--:--:--', level: 'info', text: 'Waiting for the local bridge.' },
]

export const localSessionToken = new URLSearchParams(window.location.search).get('session') ?? ''

export async function localApi(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('X-ADC-Token', localSessionToken)
  return fetch(path, { ...init, headers })
}

const endpointFor: Record<NamedOperation, string> = {
  'validate-backend': '/api/operations/validate-backend',
  'system-check': '/api/operations/system-check',
  'check-all-modules': '/api/operations/check-all-modules',
  'diagnose-module': '/api/operations/diagnose-module',
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

export async function getBridgeHealth(): Promise<BridgeHealth> {
  const response = await localApi('/api/health')
  const payload = await response.json() as BridgeHealth
  if (!response.ok) throw new Error(payload.message || 'Backend validation failed.')
  return payload
}

export async function getModuleCatalog(): Promise<Module[]> {
  const response = await localApi('/api/modules')
  const payload = await response.json() as { modules: Module[] }
  if (!response.ok) throw new Error('Could not load the module catalog.')
  return payload.modules
}
