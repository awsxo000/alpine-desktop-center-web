import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  ClipboardCheck,
  FileClock,
  FolderLock,
  HardDrive,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Moon,
  Network,
  Play,
  RefreshCw,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sun,
  TerminalSquare,
  Wrench,
  XCircle,
} from 'lucide-react'
import { getBridgeHealth, getModuleCatalog, getOperationUpdate, initialLogs, startNamedOperation } from './api'
import type { BridgeHealth, LogEntry, Module, ModuleDiagnostic, ModuleState, NamedOperation, OperationState, StepId } from './types'

const steps: Array<{ id: StepId; number: string; label: string; note: string }> = [
  { id: 'welcome', number: '01', label: 'Welcome', note: 'Release overview' },
  { id: 'validate', number: '02', label: 'Backend', note: 'Integrity lock' },
  { id: 'checks', number: '03', label: 'System check', note: 'Read-only signals' },
  { id: 'modules', number: '04', label: 'Modules', note: 'Select roles' },
  { id: 'config', number: '05', label: 'Configuration', note: 'Stable choices' },
  { id: 'summary', number: '06', label: 'Summary', note: 'Review outcome' },
]

const fallbackModules: Module[] = [
  { id: 'base', name: 'Base', description: 'Core Alpine desktop packages and privileges.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'cyan' },
  { id: 'audio', name: 'Audio', description: 'PipeWire, WirePlumber and session audio.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'amber' },
  { id: 'rede', name: 'Network', description: 'NetworkManager and managed devices.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'green' },
  { id: 'kde', name: 'KDE Plasma', description: 'Desktop shell and OpenRC compatibility.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'violet' },
  { id: 'nix', name: 'Nix', description: 'Nix package manager and user profile integration.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'blue' },
  { id: 'steam', name: 'Steam', description: 'Gaming stack and Nix application path.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'pink' },
]

type OperationRecord = {
  label: string
  operation: NamedOperation
  status: 'success' | 'error' | 'blocked'
  time: string
}

type StableChannelReport = {
  status: 'current' | 'update_available' | 'unknown'
  current_version?: string
  latest_version?: string
  latest_channel?: string
  source?: string
  message?: string
}

type StableChannelCheck = { status: 'success' | 'error' | 'blocked'; output: string; report: StableChannelReport | null; checkedAt: number }

type PendingOperation = {
  operation: NamedOperation
  label: string
  parameters: Record<string, string>
  targetStep?: StepId
}

const labelsByModule: Record<string, string> = {
  base: 'Base', audio: 'Audio', rede: 'Network', energia: 'Energy', fontes: 'Fonts',
  kde: 'KDE Plasma', bluetooth: 'Bluetooth', nix: 'Nix', nix_opengl: 'Nix OpenGL', steam: 'Steam', swap: 'Swap',
}

function isDiagnosticFresh(diagnostic?: ModuleDiagnostic): boolean {
  if (!diagnostic) return false
  const checkedAt = Date.parse(diagnostic.checked_at)
  const age = Date.now() - checkedAt
  return Number.isFinite(checkedAt) && age >= -60_000 && age <= 10 * 60_000
}

function diagnosticMatchesCatalog(module: Module, diagnostic?: ModuleDiagnostic): boolean {
  if (!diagnostic) return false
  const normalize = (id: string) => id === 'network' ? 'rede' : id
  const expected = (module.dependencies ?? []).map(normalize).sort()
  const reported = diagnostic.dependencies.map((dependency) => normalize(dependency.module)).sort()
  return new Set(expected).size === expected.length
    && new Set(reported).size === reported.length
    && diagnostic.dependencies.every((dependency) => dependency.status === 'not_checked')
    && reported.length === expected.length
    && reported.every((id, index) => id === expected[index])
}

function parseStableChannelReport(output: string): StableChannelReport | null {
  const start = output.indexOf('{')
  const end = output.lastIndexOf('}')
  if (start < 0 || end < start) return null
  try {
    const value = JSON.parse(output.slice(start, end + 1)) as Record<string, unknown>
    if (value.status === 'unknown' && typeof value.message === 'string' && value.message.length > 0) return { status: 'unknown', message: value.message }
    if (value.status !== 'current' && value.status !== 'update_available') return null
    if (value.source !== 'https://status.nixos.org/' || typeof value.latest_version !== 'string' || !/^\d+\.\d+$/.test(value.latest_version)) return null
    if (value.latest_channel !== `https://nixos.org/channels/nixos-${value.latest_version}`) return null
    const currentVersion = value.current_version
    if (currentVersion !== null && (typeof currentVersion !== 'string' || !/^\d+\.\d+$/.test(currentVersion))) return null
    if (value.status === 'current' && currentVersion !== value.latest_version) return null
    if (value.status === 'update_available' && currentVersion === value.latest_version) return null
    return {
      status: value.status,
      ...(typeof currentVersion === 'string' ? { current_version: currentVersion } : {}),
      latest_version: value.latest_version,
      latest_channel: value.latest_channel,
      source: value.source,
    }
  } catch {
    return null
  }
}

function App() {
  const [, setFreshnessTick] = useState(0)
  const [activeStep, setActiveStep] = useState<StepId>('welcome')
  const [moduleCatalog, setModuleCatalog] = useState<Module[]>([])
  const [moduleStates, setModuleStates] = useState<Record<string, ModuleState>>({})
  const [diagnostics, setDiagnostics] = useState<Record<string, ModuleDiagnostic>>({})
  const [selectedModule, setSelectedModule] = useState('audio')
  const [operation, setOperation] = useState<OperationState>('idle')
  const [activeOperation, setActiveOperation] = useState<NamedOperation | null>(null)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [activeLogPath, setActiveLogPath] = useState<string | null>(null)
  const [operationRecords, setOperationRecords] = useState<OperationRecord[]>([])
  const [stableChannelCheck, setStableChannelCheck] = useState<StableChannelCheck | null>(null)
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [darkMode, setDarkMode] = useState(false)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null)
  const [bridgeMessage, setBridgeMessage] = useState('Checking the local browser bridge…')

  const selected = useMemo(() => moduleCatalog.find((module) => module.id === selectedModule) ?? moduleCatalog[0] ?? fallbackModules[0], [moduleCatalog, selectedModule])
  const currentSection = steps.find((step) => step.id === activeStep) ?? steps[0]
  const canExecute = bridgeConnected && bridgeHealth?.backend === 'validated' && bridgeHealth?.diagnostic_schema === '1'
  const stableCheckAge = stableChannelCheck ? Date.now() - stableChannelCheck.checkedAt : Number.POSITIVE_INFINITY
  const canMigrateStable = Boolean(stableChannelCheck?.status === 'success' && stableChannelCheck.report?.status === 'update_available' && stableCheckAge >= 0 && stableCheckAge <= 10 * 60_000)
  const selectedDiagnostic = diagnostics[selected.id]
  const dependencyBlockers = (selected.dependencies ?? []).filter((id) => {
    const diagnostic = diagnostics[id]
    return !isDiagnosticFresh(diagnostic) || diagnostic.status !== 'complete'
  })
  const applyBlockReason = !canExecute
    ? 'Backend integrity or diagnostic schema is not validated.'
    : !moduleCatalog.some((module) => module.id === selected.id)
      ? 'The live module catalog is not available.'
      : !isDiagnosticFresh(selectedDiagnostic)
        ? 'Run a fresh status check for this module first; checks expire after 10 minutes.'
        : selectedDiagnostic?.status === 'unknown'
          ? 'The module diagnostic returned an unknown status; rerun it before applying.'
          : !diagnosticMatchesCatalog(selected, selectedDiagnostic)
            ? 'The module diagnostic dependency list does not match the live catalog; refresh the diagnostic before applying.'
            : dependencyBlockers.length
              ? `Check these dependencies first and require complete status: ${dependencyBlockers.map((id) => labelsByModule[id] ?? id).join(', ')}.`
              : ''
  const canApplySelected = !applyBlockReason

  useEffect(() => {
    let active = true
    void getBridgeHealth()
      .then((payload) => {
        if (!active) return
        setBridgeHealth(payload)
        setBridgeConnected(true)
        setBridgeMessage(payload.diagnostic_schema === '1' ? payload.message : `Unsupported diagnostic schema: ${payload.diagnostic_schema}. Operations are blocked.`)
      })
      .catch((error) => {
        if (!active) return
        setBridgeConnected(false)
        setBridgeHealth(null)
        setBridgeMessage(error instanceof Error ? error.message : 'The local backend bridge is not connected.')
      })
    void getModuleCatalog()
      .then((catalog) => { if (active) setModuleCatalog(catalog) })
      .catch((error) => { if (active) setBridgeMessage(error instanceof Error ? error.message : 'Could not load the module catalog.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setFreshnessTick((tick) => tick + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const addLog = (level: LogEntry['level'], text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs((current) => [...current, { time: now, level, text }].slice(-1000))
  }

  const saveRecord = (namedOperation: NamedOperation, label: string, status: OperationRecord['status']) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setOperationRecords((current) => [...current, { label, operation: namedOperation, status, time }].slice(-500))
  }

  const runOperation = async (namedOperation: NamedOperation, label: string, parameters: Record<string, string> = {}, targetStep?: StepId) => {
    if (operation === 'running') return
    const mutatesOrPreviews = namedOperation.startsWith('apply-') || namedOperation === 'simulate-full' || namedOperation === 'refresh-nix-apps' || namedOperation === 'migrate-stable-channel'
    if (namedOperation === 'check-stable-channel' || mutatesOrPreviews) setStableChannelCheck(null)
    if (namedOperation !== 'validate-backend' && !canExecute) {
      setOperation('blocked')
      setBridgeMessage('Operations are blocked until the local bridge reports a validated backend.')
      addLog('warning', `${label} was blocked because backend integrity is not validated.`)
      saveRecord(namedOperation, label, 'blocked')
      return
    }
    setOperation('running')
    setActiveOperation(namedOperation)
    setOperationId(null)
    setActiveLogPath(null)
    if (targetStep) setActiveStep(targetStep)
    addLog('info', `Starting named operation: ${label}`)
    setBridgeMessage('Opening the protected local operation channel…')
    try {
      const response = await startNamedOperation(namedOperation, parameters)
      const payload = await response.json().catch(() => ({})) as { message?: string; operation_id?: string; status?: string }
      if (!response.ok) {
        if (payload.status === 'blocked') {
          setOperation('blocked')
          setBridgeMessage(payload.message ?? 'The local bridge blocked this operation.')
          addLog('warning', `${label} was blocked: ${payload.message ?? 'no details returned'}`)
          saveRecord(namedOperation, label, 'blocked')
          return
        }
        throw new Error(payload.message ?? `Local bridge returned HTTP ${response.status}`)
      }
      if (!payload.operation_id) throw new Error('The local bridge did not return an operation session.')
      if (namedOperation.startsWith('apply-') || namedOperation === 'refresh-nix-apps' || namedOperation === 'migrate-stable-channel') {
        setDiagnostics({})
        setModuleStates({})
      }
      setOperationId(payload.operation_id)
      let cursor = 0
      let capturedOutput = ''
      const deadline = Date.now() + 16 * 60 * 1000
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        const update = await getOperationUpdate(payload.operation_id, cursor)
        if (update.output) {
          capturedOutput += update.output
          update.output.split('\n').filter(Boolean).forEach((line) => addLog('info', line))
        }
        if (update.log_path) setActiveLogPath(update.log_path)
        cursor = update.next_cursor
        if (update.results?.length) {
          setDiagnostics((current) => {
            const next = { ...current }
            update.results?.forEach((result) => { next[result.module] = result })
            return next
          })
          setModuleStates((current) => {
            const next = { ...current }
            update.results?.forEach((result) => {
              next[result.module] = result.status === 'unknown' ? 'Unknown' : result.status === 'complete' && result.summary.warnings === 0 ? 'Ready' : 'Needs attention'
            })
            return next
          })
        }
        if (update.status !== 'running') {
          setOperation(update.status)
          setBridgeMessage(update.message)
          if (namedOperation === 'validate-backend' && update.status === 'success') {
            try {
              const health = await getBridgeHealth()
              setBridgeHealth(health)
              setBridgeConnected(true)
              setBridgeMessage(health.diagnostic_schema === '1' ? health.message : `Unsupported diagnostic schema: ${health.diagnostic_schema}. Operations are blocked.`)
              try {
                setModuleCatalog(await getModuleCatalog())
              } catch (catalogError) {
                addLog('warning', catalogError instanceof Error ? `Could not refresh module catalog: ${catalogError.message}` : 'Could not refresh module catalog.')
              }
            } catch (healthError) {
              setBridgeHealth(null)
              setBridgeConnected(false)
              setBridgeMessage(healthError instanceof Error ? `Health revalidation failed: ${healthError.message}` : 'Health revalidation failed.')
            }
          }
          if (namedOperation === 'check-stable-channel') setStableChannelCheck({ status: update.status, output: capturedOutput, report: parseStableChannelReport(capturedOutput), checkedAt: Date.now() })
          const recordStatus = update.status
          saveRecord(namedOperation, label, recordStatus)
          addLog(recordStatus === 'success' ? 'success' : recordStatus === 'blocked' ? 'warning' : 'error', `${label}: ${update.message}`)
          return
        }
      }
      throw new Error('The operation exceeded the UI safety deadline. Check the system terminal and operation log before retrying.')
    } catch (error) {
      setOperation('error')
      const detail = error instanceof Error ? error.message : 'The local bridge is not reachable.'
      setBridgeMessage(detail)
      if (error instanceof TypeError) setBridgeConnected(false)
      addLog('error', `${label} failed: ${detail}`)
      saveRecord(namedOperation, label, 'error')
    }
  }

  const requestOperation = (namedOperation: NamedOperation, label: string, parameters: Record<string, string> = {}, targetStep?: StepId) => {
    if (operation === 'running') return
    if (namedOperation === 'apply-module' && !canApplySelected) {
      const message = applyBlockReason || 'A fresh diagnostic is required before applying this module.'
      setOperation('blocked')
      setBridgeMessage(message)
      addLog('warning', `${label} was blocked: ${message}`)
      saveRecord(namedOperation, label, 'blocked')
      return
    }
    if (namedOperation === 'migrate-stable-channel' && !canMigrateStable) {
      const message = 'Run a successful, recent official Stable check first; migration is allowed only while it reports an update.'
      setOperation('blocked')
      setBridgeMessage(message)
      addLog('warning', `${label} was blocked: ${message}`)
      saveRecord(namedOperation, label, 'blocked')
      return
    }
    if (!canExecute) {
      setOperation('blocked')
      setBridgeMessage('Operations are blocked until the local bridge reports a validated backend.')
      addLog('warning', `${label} was blocked because backend integrity is not validated.`)
      saveRecord(namedOperation, label, 'blocked')
      return
    }
    const needsConfirmation = namedOperation === 'simulate-full' || namedOperation.startsWith('apply-') || namedOperation === 'migrate-stable-channel' || namedOperation === 'refresh-nix-apps'
    if (needsConfirmation) {
      setPendingOperation({ operation: namedOperation, label, parameters, targetStep })
      return
    }
    void runOperation(namedOperation, label, parameters, targetStep)
  }

  const confirmPendingOperation = () => {
    if (!pendingOperation) return
    const pending = pendingOperation
    setPendingOperation(null)
    void runOperation(pending.operation, pending.label, pending.parameters, pending.targetStep)
  }

  const refreshActivity = async () => {
    if (!operationId) return
    try {
      const update = await getOperationUpdate(operationId, 0)
      if (update.log_path) setActiveLogPath(update.log_path)
      const refreshed = update.output.split('\n').filter(Boolean).map((text) => ({ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'info' as const, text }))
      setLogs(refreshed.length ? refreshed : initialLogs)
      addLog(update.status === 'running' ? 'info' : update.status === 'success' ? 'success' : 'warning', `Current operation status: ${update.status}.`)
    } catch (error) {
      addLog('error', error instanceof Error ? error.message : 'Could not refresh operation output.')
    }
  }

  const systemDiagnostics = ['base', 'audio', 'rede', 'energia'].map((id) => diagnostics[id]).filter((diagnostic): diagnostic is ModuleDiagnostic => Boolean(diagnostic))
  const systemStateLabel = !bridgeConnected ? 'BRIDGE OFFLINE' : canExecute ? 'SYSTEM VALIDATED' : 'INTEGRITY BLOCKED'

  return (
    <div className={darkMode ? 'app-shell dark' : 'app-shell light'}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div><p className="eyebrow">ALPINE LINUX</p><h1>Desktop Center</h1></div>
        </div>
        <div className="release-chip"><span className="pulse-dot" /> Local system workspace <strong>Independent operations</strong></div>
        <nav className="stepper" aria-label="Workspace sections">
          <p className="nav-caption">WORKSPACE SECTIONS</p>
          {steps.map((step) => {
            const isActive = step.id === activeStep
            return <button className={`step-item ${isActive ? 'active' : ''}`} key={step.id} onClick={() => setActiveStep(step.id)} aria-current={isActive ? 'page' : undefined}>
              <span className="step-number">{step.number}</span><span className="step-copy"><strong>{step.label}</strong><small>{step.note}</small></span>{isActive && <ChevronRight size={15} className="step-arrow" />}
            </button>
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="mini-status"><ShieldCheck size={16} /><span><strong>Integrity lock</strong><small>{canExecute ? 'Backend and schema verified' : 'Not verified'}</small></span><span className={`status-led ${canExecute ? 'green' : 'amber'}`} /></div>
          <div className="mini-status"><ServerCog size={16} /><span><strong>Backend {bridgeHealth?.backend_version ?? 'unknown'}</strong><small>Release source</small></span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb"><span>ALPINE WORKSPACE</span><ChevronRight size={14} /><strong>{currentSection.label}</strong></div>
          <div className="top-actions">
            <span className="connection-pill"><span className={`status-led ${canExecute ? 'green' : 'amber'}`} /> {bridgeConnected ? (canExecute ? 'Local bridge validated' : 'Bridge reachable · integrity/schema blocked') : 'Local bridge offline'}</span>
            <button className="icon-button" onClick={() => setDarkMode((current) => !current)} aria-label="Toggle theme" title="Toggle theme">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow accent-text">WORKSPACE SECTION {currentSection.number}</p>
            <h2>{activeStep === 'welcome' ? 'See the system. Decide the change.' : currentSection.label}</h2>
            <p className="lede">One clear workspace for inspection, decisions and safe changes. Nothing is hidden behind a generic success state.</p>
          </div>
          <div className="heading-meta"><span className="meta-label">FRONTEND</span><strong>{bridgeHealth?.frontend_version ?? 'unknown'}</strong><span className="meta-divider" /><span className="meta-label">BACKEND</span><strong>{bridgeHealth?.backend_version ?? 'unknown'}</strong></div>
        </section>

        <div className="content-grid">
          <section className="primary-column">
            {activeStep === 'welcome' && <>
              <div className="hero-card">
                <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
                <div className="hero-content">
                  <div className="hero-kicker"><span className="icon-square"><Layers3 size={17} /></span> SYSTEM WORKSPACE <span className="line" /></div>
                  <h3>Make the next step<br /><em>obvious and accountable.</em></h3>
                  <p>Inspect the current system, choose a bounded action, and keep its evidence with you from start to finish. These sections are independent; there is no required path to follow.</p>
                  <div className="hero-actions"><button className="primary-button" onClick={() => setActiveStep('validate')}>Inspect the release <ArrowRight size={16} /></button><button className="ghost-button" onClick={() => setActiveStep('modules')}>Browse modules</button></div>
                </div>
                <div className="hero-visual"><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="visual-label"><span className={`status-led ${canExecute ? 'green' : 'amber'}`} /> {systemStateLabel}</div></div>
              </div>
              <div className="section-row"><div><p className="section-kicker">CURRENT SNAPSHOT</p><h3>System signals</h3></div><button className="text-button" onClick={() => setActiveStep('validate')}>Open integrity check <ArrowRight size={15} /></button></div>
              <div className="health-grid"><HealthCard icon={<FolderLock size={18} />} label="Backend integrity" value={canExecute ? 'Validated' : bridgeConnected ? 'Blocked' : 'Unknown'} detail={bridgeMessage} tone={canExecute ? 'green' : 'blue'} /><HealthCard icon={<HardDrive size={18} />} label="Release state" value={bridgeHealth?.frontend_version ?? 'Unknown'} detail="Operation history remains in this release" tone="blue" /><HealthCard icon={<Network size={18} />} label="Stable channel" value="Not checked" detail="Run the Stable channel check for current data" tone="violet" /></div>
            </>}

            {activeStep === 'validate' && <ValidationPanel onRun={() => void runOperation('validate-backend', 'Validate embedded backend')} operation={operation} connected={canExecute} message={bridgeMessage} backendVersion={bridgeHealth?.backend_version ?? 'unknown'} frontendVersion={bridgeHealth?.frontend_version ?? 'unknown'} releasePath={bridgeHealth?.release_root ?? 'unknown'} />}
            {activeStep === 'checks' && <ChecksPanel onRun={() => void runOperation('system-check', 'Run read-only system checks')} operation={operation} diagnostics={systemDiagnostics} canExecute={canExecute} />}
            {activeStep === 'modules' && <ModulesPanel modules={(moduleCatalog.length ? moduleCatalog : fallbackModules).map((module) => moduleStates[module.id] ? { ...module, state: moduleStates[module.id] } : module)} selectedModule={selectedModule} setSelectedModule={setSelectedModule} selected={selected} selectedDiagnostic={selectedDiagnostic} applyBlockReason={applyBlockReason} onCheck={() => void runOperation('diagnose-module', `Check ${selected.name} module`, { module: selected.id }, 'modules')} onApply={() => requestOperation('apply-module', `Apply ${selected.name} module`, { module: selected.id }, 'modules')} onApplyAll={() => requestOperation('apply-full', 'Apply all modules', {}, 'modules')} operation={operation} activeOperation={activeOperation} onShowLogs={() => setLogsOpen(true)} canExecute={canExecute} canApply={canApplySelected} />}
            {activeStep === 'config' && <ConfigPanel onRun={() => void runOperation('check-stable-channel', 'Check official Stable Nix channel', {}, 'config')} onPreview={() => requestOperation('simulate-full', 'Preview full configuration', {}, 'config')} onApplyFull={() => requestOperation('apply-full', 'Apply all modules', {}, 'config')} onRefreshNixApps={() => requestOperation('refresh-nix-apps', 'Refresh Nix applications', {}, 'config')} onMigrateStable={() => requestOperation('migrate-stable-channel', 'Migrate official Stable Nix channel', {}, 'config')} operation={operation} canExecute={canExecute} stableChannelCheck={stableChannelCheck} canMigrateStable={canMigrateStable} />}
            {activeStep === 'summary' && <SummaryPanel operation={operation} records={operationRecords} onRestart={() => setActiveStep('welcome')} />}
          </section>

          <aside className="inspector-column">
            <div className="inspector-card">
              <div className="inspector-heading"><div><p className="section-kicker">OPERATION STATUS</p><h3>Protected execution</h3></div><span className={`state-badge ${operation}`}>{operation === 'idle' ? 'Ready' : operation}</span></div>
              <div className="operation-line"><div className={`operation-icon ${operation}`}><OperationIcon state={operation} size={20} /></div><div><strong>{operation === 'idle' ? 'No operation running' : operation === 'running' ? 'Operation in progress' : operation === 'blocked' ? 'Operation blocked' : operation === 'error' ? 'Operation failed' : 'Operation complete'}</strong><p>{bridgeMessage}</p></div></div>
              <div className="guard-list"><Guard icon={<LockKeyhole size={14} />} label="Named commands only" /><Guard icon={<ShieldCheck size={14} />} label="Integrity checked before commands" /><Guard icon={<TerminalSquare size={14} />} label="Credentials stay in system terminal" /></div>
            </div>
            <div className="audit-card"><div className="inspector-heading"><div><p className="section-kicker">SESSION AUDIT</p><h3>Activity stream</h3></div><button className="icon-button subtle" title="Refresh current operation" aria-label="Refresh current operation" onClick={() => void refreshActivity()} disabled={!operationId}><RefreshCw size={15} /></button></div><div className="stream-list">{logs.slice(-5).reverse().map((log, index) => <div className="stream-item" key={`${log.time}-${index}`}><span className={`stream-dot ${log.level}`} /><div><div className="stream-meta"><span>{log.time}</span><span className={`log-level ${log.level}`}>{log.level}</span></div><p>{log.text}</p></div></div>)}</div><button className="audit-link" onClick={() => setLogsOpen(true)}>Show logs <FileClock size={15} /></button></div>
            <div className="help-card"><div className="help-icon"><Wrench size={17} /></div><div><strong>Need to understand a step?</strong><p>Operations show their named command, state and captured output. Privileged authentication opens in a system terminal.</p></div></div>
          </aside>
        </div>
        {logsOpen && <LogsModal operation={operation} activeOperation={activeOperation} logs={logs} persistentLogPath={activeLogPath} onClose={() => setLogsOpen(false)} />}
        {pendingOperation && <ConfirmationModal pending={pendingOperation} module={moduleCatalog.find((item) => item.id === pendingOperation.parameters.module)} onConfirm={confirmPendingOperation} onCancel={() => setPendingOperation(null)} />}
      </main>
    </div>
  )
}

function OperationIcon({ state, size = 20 }: { state: OperationState; size?: number }) {
  const Icon = { idle: CircleDashed, running: LoaderCircle, waiting: CircleAlert, success: CheckCircle2, error: XCircle, blocked: LockKeyhole }[state]
  return <Icon size={size} />
}

function HealthCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="health-card"><div className={`card-icon ${tone}`}>{icon}</div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
}

function Guard({ icon, label }: { icon: ReactNode; label: string }) {
  return <div className="guard-item">{icon}<span>{label}</span><Check size={13} /></div>
}

function PanelHeader({ icon, eyebrow, title, detail }: { icon: ReactNode; eyebrow: string; title: string; detail: string }) {
  return <div className="panel-header"><div className="panel-icon">{icon}</div><div><p className="section-kicker">{eyebrow}</p><h3>{title}</h3><p>{detail}</p></div></div>
}

function OperationButton({ children, onClick, operation, icon = <Play size={15} />, disabled = false }: { children: ReactNode; onClick: () => void; operation: OperationState; icon?: ReactNode; disabled?: boolean }) {
  const isRunning = operation === 'running'
  return <button className={`primary-button${isRunning ? ' is-running' : ''}`} onClick={onClick} disabled={isRunning || disabled} aria-busy={isRunning}>{isRunning ? <LoaderCircle className="spin" size={15} /> : icon}{children}</button>
}

function ValidationPanel({ onRun, operation, connected, message, backendVersion, frontendVersion, releasePath }: { onRun: () => void; operation: OperationState; connected: boolean; message: string; backendVersion: string; frontendVersion: string; releasePath: string }) {
  return <div className="panel-card"><PanelHeader icon={<ShieldCheck size={22} />} eyebrow="BACKEND VALIDATION" title="The execution lock is active." detail="Every action starts with a fresh check of the embedded backend and its SHA-256 manifest." /><div className={`validation-banner ${connected ? '' : 'invalid'}`}>{connected ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}<div><strong>{connected ? 'Backend detected and validated' : 'Backend validation unavailable'}</strong><p>{message}</p></div><span className={`state-badge ${connected ? 'success' : 'blocked'}`}>{connected ? 'PASS' : 'BLOCKED'}</span></div><div className="metric-list"><Metric label="Backend version" value={backendVersion} /><Metric label="Frontend version" value={frontendVersion} /><Metric label="Release location" value={releasePath} /><Metric label="Last validation" value={connected ? 'Current session' : 'Not validated'} /></div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />}>Validate again</OperationButton></div></div>
}

function ChecksPanel({ onRun, operation, diagnostics, canExecute }: { onRun: () => void; operation: OperationState; diagnostics: ModuleDiagnostic[]; canExecute: boolean }) {
  const rows = diagnostics.flatMap((diagnostic) => [{
    label: labelsByModule[diagnostic.module] ?? diagnostic.module,
    value: `${diagnostic.summary.passed}/${diagnostic.summary.total} checks passed · ${diagnostic.summary.warnings} warnings · ${diagnostic.summary.failed} errors · ${new Date(diagnostic.checked_at).toLocaleString()}`,
    state: diagnostic.status === 'complete' && diagnostic.summary.warnings === 0 ? 'pass' : diagnostic.status === 'unknown' ? 'neutral' : 'warn',
  }])
  const shownRows = rows.length ? rows : [{ label: 'No live system checks yet', value: 'Run the read-only diagnostic to inspect this system.', state: 'neutral' }]
  return <div className="panel-card"><PanelHeader icon={<ClipboardCheck size={22} />} eyebrow="READ-ONLY INSPECTION" title="See the system before changing it." detail="Results appear only after a live diagnostic. These checks do not apply configuration." /><div className="check-table">{shownRows.map((check) => <div className="check-row" key={check.label}><span className={`check-status ${check.state}`}>{check.state === 'pass' ? <Check size={14} /> : check.state === 'warn' ? <CircleAlert size={14} /> : <CircleDashed size={14} />}</span><div><strong>{check.label}</strong><small>{check.value}</small></div><ChevronRight size={16} /></div>)}</div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation} disabled={!canExecute}>Run system check</OperationButton><span className="muted-note"><LockKeyhole size={13} /> Read-only operation</span></div></div>
}

function ModulesPanel({ modules, selectedModule, setSelectedModule, selected, selectedDiagnostic, applyBlockReason, onCheck, onApply, onApplyAll, operation, activeOperation, onShowLogs, canExecute, canApply }: { modules: Module[]; selectedModule: string; setSelectedModule: (id: string) => void; selected: Module; selectedDiagnostic?: ModuleDiagnostic; applyBlockReason: string; onCheck: () => void; onApply: () => void; onApplyAll: () => void; operation: OperationState; activeOperation: NamedOperation | null; onShowLogs: () => void; canExecute: boolean; canApply: boolean }) {
  const dependencies = selected.dependencies?.map((id) => labelsByModule[id] ?? id) ?? []
  const checkSummary = selectedDiagnostic
    ? `Diagnostic: ${selectedDiagnostic.status} · ${selectedDiagnostic.summary.passed}/${selectedDiagnostic.summary.total} checks passed · ${selectedDiagnostic.summary.warnings} warnings · checked ${new Date(selectedDiagnostic.checked_at).toLocaleString()}`
    : 'Run Check status before applying this module.'
  return <div className="panel-card modules-panel">
    <PanelHeader icon={<Layers3 size={22} />} eyebrow="ROLE CATALOG" title="Choose a module operation." detail="Check the installed components first. Missing items are listed below; Apply module can restore them after dependencies are complete." />
    <div className="modules-workspace">
      <nav className="module-list" aria-label="Modules">{modules.map((module) => <button className={`module-row ${selectedModule === module.id ? 'selected' : ''}`} key={module.id} onClick={() => setSelectedModule(module.id)} disabled={operation === 'running'} aria-pressed={selectedModule === module.id}><span className={`module-avatar ${module.accent}`}>{module.name.slice(0, 2).toUpperCase()}</span><span className="module-copy"><strong>{module.name}</strong><small>{module.description}</small></span><span className={`module-state ${module.state.toLowerCase().replace(' ', '-')}`}><span className="status-led" />{module.state}</span><ChevronRight size={16} /></button>)}</nav>
      <div className="module-detail-pane">
      {operation === 'running' ? <ModuleOperationLoading module={selected} activeOperation={activeOperation} onShowLogs={onShowLogs} /> : <div className="selected-module-block">
      <div className="selected-module">
        <div><p className="section-kicker">SELECTED MODULE</p><h4>{selected.name}</h4><p>{selected.detail}</p><p className="muted-note">{checkSummary}</p>{dependencies.length > 0 && <p className="module-dependencies">Dependencies: {dependencies.join(', ')}.</p>}{!canApply && <div className="manual-attention"><LockKeyhole size={15} /><span>{applyBlockReason}</span></div>}</div>
        <div className="module-actions"><OperationButton onClick={onCheck} operation={operation} icon={<Activity size={15} />} disabled={!canExecute}>Check status</OperationButton><OperationButton onClick={onApply} operation={operation} icon={<Wrench size={15} />} disabled={!canApply}>Apply module</OperationButton><OperationButton onClick={onApplyAll} operation={operation} icon={<Layers3 size={15} />} disabled={!canExecute}>Apply all modules</OperationButton></div>
      </div>
      {selectedDiagnostic && <section className="diagnostic-check-list" aria-label={`${selected.name} component checks`}>
        <div className="diagnostic-check-heading"><strong>Component checks</strong><span>{selectedDiagnostic.summary.failed} missing or failed · {selectedDiagnostic.summary.warnings} warnings</span></div>
        <ul>{selectedDiagnostic.checks.map((check) => <li className={`diagnostic-check ${check.status}`} key={check.id}>
          <span className={`diagnostic-check-state ${check.status}`}>{check.status === 'ok' ? 'PASS' : check.status === 'error' ? 'MISSING' : check.status === 'warning' ? 'WARN' : 'UNKNOWN'}</span>
          <div><strong>{check.title}</strong><p>{check.message}</p></div>
          <span className="diagnostic-check-kind">{check.required ? 'Required' : 'Optional'}</span>
        </li>)}</ul>
      </section>}
      </div>}
      </div>
    </div>
  </div>
}
function ModuleOperationLoading({ module, activeOperation, onShowLogs }: { module: Module; activeOperation: NamedOperation | null; onShowLogs: () => void }) {
  const fullApply = activeOperation === 'apply-full' || activeOperation === 'apply-diagnostics'
  const requiresSystemTerminal = fullApply || activeOperation === 'apply-module'
  const title = activeOperation === 'diagnose-module' ? `Checking ${module.name}` : fullApply ? 'Applying all modules' : `Applying ${module.name}`
  const waitingMessage = requiresSystemTerminal
    ? 'Live output appears in Show logs while the system terminal runs. Check whether the terminal is behind this window; do not retry the operation.'
    : 'The read-only diagnostic is running. Open Show logs if it takes longer than expected.'
  return <div className="module-operation-loading"><div className="loading-orbit"><LoaderCircle className="spin" size={24} /></div><div className="loading-copy"><p className="section-kicker">OPERATION IN PROGRESS</p><h4>{title}</h4><p>{waitingMessage}</p>{requiresSystemTerminal && <div className="manual-attention"><CircleAlert size={16} /><span><strong>Authentication happens outside the browser.</strong> If doas asks for a password, enter it only in the separate system terminal.</span></div>}</div><button className="secondary-button" onClick={onShowLogs}><TerminalSquare size={15} /> Show logs</button></div>
}
function ConfigPanel({ onRun, onPreview, onApplyFull, onRefreshNixApps, onMigrateStable, operation, canExecute, stableChannelCheck, canMigrateStable }: { onRun: () => void; onPreview: () => void; onApplyFull: () => void; onRefreshNixApps: () => void; onMigrateStable: () => void; operation: OperationState; canExecute: boolean; stableChannelCheck: StableChannelCheck | null; canMigrateStable: boolean }) {
  const reportStatus = stableChannelCheck?.report?.status
  const channelLabel = stableChannelCheck?.status === 'blocked' ? 'Check blocked'
    : stableChannelCheck?.status === 'error' ? 'Check failed'
      : reportStatus === 'current' ? 'Up to date'
        : reportStatus === 'update_available' ? 'Update available'
          : stableChannelCheck ? 'Status unknown' : 'Not checked'
  const channelBadge = stableChannelCheck ? (stableChannelCheck.status === 'success' ? reportStatus ?? 'unknown' : stableChannelCheck.status) : 'pending'
  const channelOutput = stableChannelCheck?.report
    ? stableChannelCheck.report.message ?? `Installed nixos-${stableChannelCheck.report.current_version ?? 'unknown'} · latest nixos-${stableChannelCheck.report.latest_version ?? 'unknown'}`
    : stableChannelCheck ? 'The official Stable status endpoint did not return a recognized response.' : ''
  return <div className="panel-card">
    <PanelHeader icon={<Settings2 size={22} />} eyebrow="STABLE CONFIGURATION" title="Keep the stable path predictable." detail="The web workflow exposes only official Stable Nix channels. Unstable options are intentionally absent." />
    <div className="channel-card"><div className="channel-mark">N</div><div><span className="channel-label">CURRENT CHANNEL</span><strong>{channelLabel}</strong><p>{channelOutput || 'Run the check to query the installed official Stable channel.'}</p></div><span className={`state-badge ${channelBadge}`}>{channelLabel}</span></div>
    <div className="config-options"><div className="config-option active"><span className="radio-dot" /><div><strong>Official Stable</strong><small>Use the curated channel selected by the project.</small></div><Check size={15} /></div><div className="config-option disabled"><span className="radio-dot" /><div><strong>Unstable</strong><small>Not exposed by Alpine Desktop Center.</small></div><LockKeyhole size={15} /></div></div>
    <div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />} disabled={!canExecute}>Check Stable channel</OperationButton><button className="secondary-button" onClick={onPreview} disabled={operation === 'running' || !canExecute}><Activity size={15} /> Preview configuration</button><OperationButton onClick={onApplyFull} operation={operation} icon={<Wrench size={15} />} disabled={!canExecute}>Apply all modules</OperationButton></div>
    <div className="panel-actions"><OperationButton onClick={onRefreshNixApps} operation={operation} icon={<RefreshCw size={15} />} disabled={!canExecute}>Refresh Nix applications</OperationButton><OperationButton onClick={onMigrateStable} operation={operation} icon={<Wrench size={15} />} disabled={!canExecute || !canMigrateStable}>Migrate to latest Stable</OperationButton><span className="muted-note"><LockKeyhole size={13} /> Migration requires a successful check no older than 10 minutes that reports an update.</span></div>
  </div>
}

function LogsModal({ operation, activeOperation, logs, persistentLogPath, onClose }: { operation: OperationState; activeOperation: NamedOperation | null; logs: LogEntry[]; persistentLogPath: string | null; onClose: () => void }) {
  const systemTerminal = activeOperation === 'simulate-full' || activeOperation === 'apply-full' || activeOperation === 'apply-diagnostics' || activeOperation === 'apply-module' || activeOperation === 'refresh-nix-apps' || activeOperation === 'migrate-stable-channel'
  return <div className="logs-modal-backdrop" role="dialog" aria-modal="true" aria-label="Operation logs"><div className="panel-card logs-modal"><div className="inspector-heading"><div><p className="section-kicker">OPERATION LOGS</p><h3>Backend output</h3></div><button className="icon-button" onClick={onClose} aria-label="Close logs"><XCircle size={17} /></button></div><div className="execution-state"><div className={`big-state-icon ${operation}`}><OperationIcon state={operation} size={24} /></div><div><span className="section-kicker">CURRENT STATE</span><strong>{operation === 'running' ? 'Running operation' : operation === 'error' ? 'Operation failed' : operation === 'blocked' ? 'Operation blocked' : operation === 'success' ? 'Operation finished' : 'Waiting for an operation'}</strong><p>Named command: <code>{activeOperation ?? 'none'}</code></p></div></div>{systemTerminal && <div className="manual-attention"><TerminalSquare size={16} /><span>This operation runs in a separate system terminal. If authentication is requested, enter credentials only there. Do not enter credentials in the browser.</span></div>}{persistentLogPath && <p className="persistent-log-path"><strong>Saved log:</strong> <code>{persistentLogPath}</code></p>}<div className="terminal"><div className="terminal-bar"><span /><span /><span /><small>activity.log · current session</small></div><div className="terminal-body">{logs.map((log, index) => <div className="terminal-line" key={`${log.time}-${index}`}><span className="terminal-time">[{log.time}]</span><span className={`terminal-level ${log.level}`}>{log.level.toUpperCase()}</span><span>{log.text}</span></div>)}{operation === 'running' && <div className="terminal-line live"><LoaderCircle className="spin" size={14} /> Waiting for local operation output…</div>}</div></div></div></div>
}

function ConfirmationModal({ pending, module, onConfirm, onCancel }: { pending: PendingOperation; module?: Module; onConfirm: () => void; onCancel: () => void }) {
  const [understood, setUnderstood] = useState(false)
  const fullApply = pending.operation === 'apply-full'
  const preview = pending.operation === 'simulate-full'
  const migrateStable = pending.operation === 'migrate-stable-channel'
  const refreshNixApps = pending.operation === 'refresh-nix-apps'
  const title = preview ? 'Run a full configuration preview?' : fullApply ? 'Apply all modules?' : migrateStable ? 'Migrate to the latest official Stable Nix channel?' : refreshNixApps ? 'Refresh Nix applications?' : `Apply ${module?.name ?? pending.parameters.module ?? 'selected module'}?`
  const description = preview
    ? 'This runs Ansible in check mode with diff only when make, Ansible and prepared release-local state already exist; it does not install prerequisites. Check mode is best-effort: command and shell tasks without check-mode support may be skipped.'
    : fullApply
      ? 'The current backend defaults can install packages, enable or reconfigure services, create a 12 GiB swapfile and update boot parameters for hibernation when supported.'
      : migrateStable
        ? 'The operation updates the configured Nix channel and runs nix-channel --update. It is enabled only after the official Stable check reports a newer release.'
        : refreshNixApps
          ? 'The operation updates applications in the current user Nix profile. Review the terminal output and verify the profile afterwards.'
          : 'This role can install or update packages and change system services or configuration files.'
  const changeLabel = preview ? 'Preview check mode; still best-effort.' : migrateStable || refreshNixApps ? 'This action changes the user Nix profile or channel.' : 'This action changes the installed system.'
  const actionLabel = preview ? 'Run preview' : migrateStable ? 'Migrate Stable' : refreshNixApps ? 'Refresh applications' : 'Confirm and run'
  return <div className="logs-modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="apply-confirm-title"><div className="panel-card logs-modal"><div className="inspector-heading"><div><p className="section-kicker">{preview ? 'CONFIRM BEST-EFFORT PREVIEW' : 'CONFIRM SYSTEM CHANGE'}</p><h3 id="apply-confirm-title">{title}</h3></div><button className="icon-button" onClick={onCancel} aria-label="Cancel operation"><XCircle size={17} /></button></div><div className="validation-banner invalid"><CircleAlert size={20} /><div><strong>{changeLabel}</strong><p>{description}</p><p>Review terminal output before proceeding; use a disposable VM snapshot for early testing.</p></div></div><label className="confirm-acknowledgement"><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> I understand this operation can modify system, Nix profile, or release-local state.</label><div className="panel-actions"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={onConfirm} disabled={!understood}>{preview ? <Activity size={15} /> : <Wrench size={15} />}{actionLabel}</button></div></div></div>
}

function SummaryPanel({ operation, records, onRestart }: { operation: OperationState; records: OperationRecord[]; onRestart: () => void }) {
  const applied = records.filter((record) => record.status === 'success' && record.operation.startsWith('apply-')).length
  const warnings = records.filter((record) => record.status === 'error' || record.status === 'blocked').length
  return <div className="panel-card summary-panel"><div className="summary-icon"><CheckCircle2 size={32} /></div><p className="section-kicker">SESSION SUMMARY</p><h3>{operation === 'success' ? 'The operation completed.' : operation === 'error' ? 'An operation failed.' : operation === 'blocked' ? 'An operation was blocked.' : 'Your workspace is ready to continue.'}</h3><p className="summary-copy">Counts below reflect operations recorded in this browser session; they are not a system-wide history.</p><div className="summary-stats"><Metric label="Successful applies" value={`${applied}`} /><Metric label="Warnings / blocks" value={`${warnings}`} /><Metric label="Session records" value={`${records.length}`} /></div><button className="secondary-button" onClick={onRestart}>Return to overview</button></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

export default App
