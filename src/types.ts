export type StepId = 'welcome' | 'validate' | 'checks' | 'modules' | 'config' | 'summary'

export type OperationState = 'idle' | 'running' | 'waiting' | 'success' | 'error' | 'blocked'

export type ModuleState = 'Ready' | 'Needs attention' | 'Not detected' | 'Unknown'

export type Module = {
  id: string
  name: string
  description: string
  state: ModuleState
  detail: string
  accent: string
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
  | 'apply-full'
  | 'apply-diagnostics'
  | 'refresh-nix-apps'
  | 'check-stable-channel'
  | 'migrate-stable-channel'
  | 'apply-module'

export type BackendStatus = {
  version: string
  frontendVersion: string
  integrity: 'validated' | 'unknown' | 'failed'
  releasePath: string
  lastValidated: string
  operation: OperationState
  activeOperation: string
}

export type BridgeHealth = {
  bridge: 'local' | 'unknown'
  backend: 'validated' | 'failed'
  message: string
  frontend_version?: string
}
