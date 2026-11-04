import type { BackendStatus, LogEntry, NamedOperation } from './types'

export const backendStatus: BackendStatus = {
  version: 'v1.43',
  frontendVersion: '0.1.0-alpha.4-web',
  integrity: 'validated',
  releasePath: './backend',
  lastValidated: 'Just now',
  operation: 'idle',
  activeOperation: 'Ready for a named operation',
}

export const initialLogs: LogEntry[] = [
  { time: '14:14:22', level: 'success', text: 'Embedded backend v1.43 validated against the release manifest.' },
  { time: '14:14:23', level: 'info', text: 'Local workspace is ready for a named operation.' },
]

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
  return fetch(endpointFor[operation], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operation, ...parameters }),
  })
}
