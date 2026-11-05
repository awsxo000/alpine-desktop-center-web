import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
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
import { backendStatus, getBridgeHealth, getModuleCatalog, getOperationUpdate, initialLogs, sendOperationInput, startNamedOperation } from './api'
import type { LogEntry, Module, NamedOperation, OperationState, StepId } from './types'

const steps: Array<{ id: StepId; number: string; label: string; note: string }> = [
  { id: 'welcome', number: '01', label: 'Welcome', note: 'Release overview' },
  { id: 'validate', number: '02', label: 'Backend', note: 'Integrity lock' },
  { id: 'checks', number: '03', label: 'System check', note: 'Read-only signals' },
  { id: 'modules', number: '04', label: 'Modules', note: 'Select roles' },
  { id: 'config', number: '05', label: 'Configuration', note: 'Stable choices' },
  { id: 'summary', number: '06', label: 'Summary', note: 'Review outcome' },
]

const modules: Module[] = [
  { id: 'base', name: 'Base', description: 'Core packages, users and shell defaults.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'cyan' },
  { id: 'audio', name: 'Audio', description: 'PipeWire, WirePlumber and session audio.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'amber' },
  { id: 'network', name: 'Network', description: 'NetworkManager and managed devices.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'green' },
  { id: 'kde', name: 'KDE Plasma', description: 'Desktop shell, menu and session defaults.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'violet' },
  { id: 'nix', name: 'Nix', description: 'Stable channel and user profile tooling.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'blue' },
  { id: 'steam', name: 'Steam', description: 'Gaming stack and Nix application path.', state: 'Unknown', detail: 'Run a live diagnostic.', accent: 'pink' },
]

function App() {
  const [activeStep, setActiveStep] = useState<StepId>('welcome')
  const [moduleCatalog, setModuleCatalog] = useState<Module[]>([])
  const [selectedModule, setSelectedModule] = useState('audio')
  const [operation, setOperation] = useState<OperationState>('idle')
  const [activeOperation, setActiveOperation] = useState<NamedOperation | null>(null)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [darkMode, setDarkMode] = useState(false)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [bridgeMessage, setBridgeMessage] = useState('Checking the local browser bridge…')

  const selected = useMemo(() => moduleCatalog.find((module) => module.id === selectedModule) ?? moduleCatalog[0] ?? modules[0], [moduleCatalog, selectedModule])
  const currentSection = steps.find((step) => step.id === activeStep) ?? steps[0]

  useEffect(() => {
    Promise.all([getBridgeHealth(), getModuleCatalog()])
      .then(([payload, catalog]) => {
        setModuleCatalog(catalog)
        setBridgeConnected(true)
        setBridgeMessage(payload.message)
      })
      .catch((error) => {
        setBridgeConnected(false)
        setBridgeMessage(error instanceof Error ? error.message : 'The local backend bridge is not connected.')
      })
  }, [])

  const addLog = (level: LogEntry['level'], text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs((current) => [...current, { time: now, level, text }])
  }

  const runOperation = async (namedOperation: NamedOperation, label: string, parameters: Record<string, string> = {}, targetStep?: StepId) => {
    if (operation === 'running') return
    setOperation('running')
    setActiveOperation(namedOperation)
    setOperationId(null)
    if (targetStep) setActiveStep(targetStep)
    addLog('info', `Starting named operation: ${label}`)
    setBridgeMessage('Opening a protected local operation channel…')
    try {
      const response = await startNamedOperation(namedOperation, parameters)
      const payload = await response.json().catch(() => ({})) as { message?: string; operation_id?: string }
      if (!response.ok) throw new Error(payload.message ?? `Local bridge returned HTTP ${response.status}`)
      if (!payload.operation_id) throw new Error('The local bridge did not return an operation session.')
      setOperationId(payload.operation_id)
      let cursor = 0
      let finalStatus: 'success' | 'error' | 'blocked' = 'success'
      while (true) {
        await new Promise((resolve) => window.setTimeout(resolve, 250))
        const update = await getOperationUpdate(payload.operation_id, cursor)
        if (update.output) update.output.split('\n').filter(Boolean).forEach((line) => addLog('info', line))
        cursor = update.next_cursor
        if (update.status !== 'running') {
          finalStatus = update.status
          if (update.status !== 'success') throw new Error(update.message)
          break
        }
      }
      void finalStatus
      setOperation('success')
      setBridgeMessage('Operation completed. Review the captured output before continuing.')
      addLog('success', `${label} completed successfully.`)
    } catch (error) {
      setOperation('error')
      const detail = error instanceof Error ? error.message : 'The local bridge is not reachable.'
      setBridgeMessage(bridgeConnected ? 'The local bridge returned an execution error. Review the captured backend output.' : 'The UI is ready, but the local backend bridge is not connected in this Preview.')
      addLog('warning', `${label} is waiting for the local bridge: ${detail}`)
    }
  }

  return (
    <div className={darkMode ? 'app-shell dark' : 'app-shell light'}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="eyebrow">ALPINE LINUX</p>
            <h1>Desktop Center</h1>
          </div>
        </div>

        <div className="release-chip"><span className="pulse-dot" /> Local system workspace <strong>Independent operations</strong></div>

        <nav className="stepper" aria-label="Workspace sections">
          <p className="nav-caption">WORKSPACE SECTIONS</p>
          {steps.map((step) => {
            const isActive = step.id === activeStep
            return (
              <button className={`step-item ${isActive ? 'active' : ''}`} key={step.id} onClick={() => setActiveStep(step.id)} aria-current={isActive ? 'page' : undefined}>
                <span className="step-number">{step.number}</span>
                <span className="step-copy"><strong>{step.label}</strong><small>{step.note}</small></span>
                {isActive && <ChevronRight size={15} className="step-arrow" />}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="mini-status"><ShieldCheck size={16} /><span><strong>Integrity lock</strong><small>Execution is guarded</small></span><span className="status-led green" /></div>
          <div className="mini-status"><ServerCog size={16} /><span><strong>Backend {backendStatus.version}</strong><small>Embedded release source</small></span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb"><span>ALPINE WORKSPACE</span><ChevronRight size={14} /><strong>{currentSection.label}</strong></div>
          <div className="top-actions">
            <span className="connection-pill"><span className={`status-led ${bridgeConnected ? 'green' : 'amber'}`} /> {bridgeConnected ? 'Local bridge connected' : 'Preview bridge pending'}</span>
            <button className="icon-button" onClick={() => setDarkMode((current) => !current)} aria-label="Toggle theme" title="Toggle theme">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow accent-text">WORKSPACE SECTION {currentSection.number}</p>
            <h2>{activeStep === 'welcome' ? 'See the system. Decide the change.' : currentSection.label}</h2>
            <p className="lede">One clear workspace for inspection, decisions and safe changes. Nothing is hidden behind a generic success state.</p>
          </div>
          <div className="heading-meta"><span className="meta-label">FRONTEND</span><strong>{backendStatus.frontendVersion}</strong><span className="meta-divider" /><span className="meta-label">BACKEND</span><strong>{backendStatus.version}</strong></div>
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
                <div className="hero-visual"><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="visual-label"><span className="status-led green" /> SYSTEM READY</div></div>
              </div>
              <div className="section-row"><div><p className="section-kicker">CURRENT SNAPSHOT</p><h3>System signals</h3></div><button className="text-button" onClick={() => setActiveStep('validate')}>Open integrity check <ArrowRight size={15} /></button></div>
              <div className="health-grid"><HealthCard icon={<FolderLock size={18} />} label="Backend integrity" value={bridgeConnected ? 'Validated' : 'Unknown'} detail={bridgeConnected ? 'SHA-256 manifest matches' : 'Start the local bridge to validate'} tone="green" /><HealthCard icon={<HardDrive size={18} />} label="Release state" value="Local workspace" detail="Operation history is stored inside this release" tone="blue" /><HealthCard icon={<Network size={18} />} label="Stable channel" value="Not checked" detail="Run the Stable channel check for current data" tone="violet" /></div>
            </>}

            {activeStep === 'validate' && <ValidationPanel onRun={() => runOperation('validate-backend', 'Validate embedded backend')} operation={operation} connected={bridgeConnected} message={bridgeMessage} />}
            {activeStep === 'checks' && <ChecksPanel onRun={() => runOperation('system-check', 'Run read-only system checks')} operation={operation} />}
            {activeStep === 'modules' && <ModulesPanel modules={moduleCatalog.length ? moduleCatalog : modules} selectedModule={selectedModule} setSelectedModule={setSelectedModule} selected={selected} onCheck={() => runOperation('diagnose-module', `Check ${selected.name} module`, { module: selected.id }, 'modules')} onApply={() => runOperation('apply-module', `Apply ${selected.name} module`, { module: selected.id }, 'modules')} operation={operation} activeOperation={activeOperation} onShowLogs={() => setLogsOpen(true)} />}
            {activeStep === 'config' && <ConfigPanel onRun={() => runOperation('check-stable-channel', 'Check official Stable Nix channel', {}, 'config')} onApplyFull={() => runOperation('apply-full', 'Apply full configuration', {}, 'config')} operation={operation} />}
            {activeStep === 'summary' && <SummaryPanel operation={operation} onRestart={() => setActiveStep('welcome')} />}

          </section>

          <aside className="inspector-column">
            <div className="inspector-card">
              <div className="inspector-heading"><div><p className="section-kicker">OPERATION STATUS</p><h3>Protected execution</h3></div><span className={`state-badge ${operation}`}>{operation === 'idle' ? 'Ready' : operation}</span></div>
              <div className="operation-line"><div className={`operation-icon ${operation}`}><OperationIcon state={operation} size={20} /></div><div><strong>{operation === 'idle' ? 'No operation running' : operation === 'running' ? 'Operation in progress' : operation === 'error' ? 'Bridge connection needed' : 'Operation complete'}</strong><p>{bridgeMessage}</p></div></div>
              <div className="guard-list"><Guard icon={<LockKeyhole size={14} />} label="Named commands only" /><Guard icon={<ShieldCheck size={14} />} label="Integrity rechecked before run" /><Guard icon={<TerminalSquare size={14} />} label="Password stays in local doas" /></div>
            </div>

            <div className="audit-card"><div className="inspector-heading"><div><p className="section-kicker">LIVE AUDIT</p><h3>Activity stream</h3></div><button className="icon-button subtle" title="Refresh activity"><RefreshCw size={15} /></button></div><div className="stream-list">{logs.slice(-5).reverse().map((log, index) => <div className="stream-item" key={`${log.time}-${index}`}><span className={`stream-dot ${log.level}`} /><div><div className="stream-meta"><span>{log.time}</span><span className={`log-level ${log.level}`}>{log.level}</span></div><p>{log.text}</p></div></div>)}</div><button className="audit-link" onClick={() => setLogsOpen(true)}>Show logs <FileClock size={15} /></button></div>

            <div className="help-card"><div className="help-icon"><Wrench size={17} /></div><div><strong>Need to understand a step?</strong><p>Every operation will show its command, state and raw output in the browser.</p></div></div>
          </aside>
        </div>
        {logsOpen && <LogsModal operation={operation} activeOperation={activeOperation} operationId={operationId} logs={logs} onSendInput={async (input) => { if (operationId) { await sendOperationInput(operationId, input); addLog('info', 'Hidden input sent to the local PTY.') } }} onClose={() => setLogsOpen(false)} />}
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

function OperationButton({ children, onClick, operation, icon = <Play size={15} /> }: { children: ReactNode; onClick: () => void; operation: OperationState; icon?: ReactNode }) {
  return <button className="primary-button" onClick={onClick} disabled={operation === 'running'}>{operation === 'running' ? <LoaderCircle className="spin" size={15} /> : icon}{children}</button>
}

function ValidationPanel({ onRun, operation, connected, message }: { onRun: () => void; operation: OperationState; connected: boolean; message: string }) {
  return <div className="panel-card"><PanelHeader icon={<ShieldCheck size={22} />} eyebrow="BACKEND VALIDATION" title="The execution lock is active." detail="Every action starts with a fresh check of the embedded backend and its SHA-256 manifest." /><div className={`validation-banner ${connected ? '' : 'invalid'}`}><>{connected ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}</><div><strong>{connected ? 'Backend detected and validated' : 'Backend validation unavailable'}</strong><p>{message}</p></div><span className={`state-badge ${connected ? 'success' : 'error'}`}>{connected ? 'PASS' : 'BLOCKED'}</span></div><div className="metric-list"><Metric label="Backend version" value={backendStatus.version} /><Metric label="Diagnostic schema" value="1" /><Metric label="Release location" value={backendStatus.releasePath} /><Metric label="Last validation" value={connected ? 'Current session' : 'Not validated'} /></div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />}>Validate again</OperationButton></div></div>
}

function ChecksPanel({ onRun, operation }: { onRun: () => void; operation: OperationState }) {
  const checks = [{ label: 'Alpine release', value: '3.24', state: 'pass' }, { label: 'Package repositories', value: 'Ready to inspect', state: 'neutral' }, { label: 'doas authentication', value: 'Local terminal only', state: 'neutral' }, { label: 'Audio session', value: 'Needs review', state: 'warn' }]
  return <div className="panel-card"><PanelHeader icon={<ClipboardCheck size={22} />} eyebrow="READ-ONLY INSPECTION" title="See the system before changing it." detail="These checks never apply configuration. They provide the context needed for a safe decision." /><div className="check-table">{checks.map((check) => <div className="check-row" key={check.label}><span className={`check-status ${check.state}`}>{check.state === 'pass' ? <Check size={14} /> : check.state === 'warn' ? <CircleAlert size={14} /> : <CircleDashed size={14} />}</span><div><strong>{check.label}</strong><small>{check.value}</small></div><ChevronRight size={16} /></div>)}</div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation}>Run system check</OperationButton><span className="muted-note"><LockKeyhole size={13} /> Read-only operation</span></div></div>
}

function ModulesPanel({ modules, selectedModule, setSelectedModule, selected, onCheck, onApply, operation, activeOperation, onShowLogs }: { modules: Module[]; selectedModule: string; setSelectedModule: (id: string) => void; selected: Module; onCheck: () => void; onApply: () => void; operation: OperationState; activeOperation: NamedOperation | null; onShowLogs: () => void }) {
  return <div className="panel-card"><PanelHeader icon={<Layers3 size={22} />} eyebrow="ROLE CATALOG" title="Choose an independent module operation." detail="Modules map directly to backend roles. Inspect or apply one module without completing the other sections or installing modules one by one." /><div className="module-list">{modules.map((module) => <button className={`module-row ${selectedModule === module.id ? 'selected' : ''}`} key={module.id} onClick={() => setSelectedModule(module.id)} disabled={operation === 'running'}><span className={`module-avatar ${module.accent}`}>{module.name.slice(0, 2).toUpperCase()}</span><span className="module-copy"><strong>{module.name}</strong><small>{module.description}</small></span><span className={`module-state ${module.state.toLowerCase().replace(' ', '-')}`}><span className="status-led" />{module.state}</span><ChevronRight size={16} /></button>)}</div>{operation === 'running' ? <ModuleOperationLoading module={selected} activeOperation={activeOperation} onShowLogs={onShowLogs} /> : <div className="selected-module"><div><p className="section-kicker">SELECTED MODULE</p><h4>{selected.name}</h4><p>{selected.detail}. Check status is read-only; Apply module runs only this backend tag.</p></div><div className="module-actions"><OperationButton onClick={onCheck} operation={operation} icon={<Activity size={15} />}>Check status</OperationButton><OperationButton onClick={onApply} operation={operation} icon={<Wrench size={15} />}>Apply module</OperationButton></div></div>}</div>
}

function ModuleOperationLoading({ module, activeOperation, onShowLogs }: { module: Module; activeOperation: NamedOperation | null; onShowLogs: () => void }) {
  const needsManualAttention = activeOperation === 'apply-module'
  return <div className="module-operation-loading"><div className="loading-orbit"><LoaderCircle className="spin" size={24} /></div><div className="loading-copy"><p className="section-kicker">OPERATION IN PROGRESS</p><h4>{activeOperation === 'diagnose-module' ? `Checking ${module.name}` : `Applying ${module.name}`}</h4><p>The backend is running this module independently. You do not need to complete another section.</p>{needsManualAttention && <div className="manual-attention"><CircleAlert size={16} /><span><strong>Watch for manual intervention.</strong> If doas requests authentication or the backend asks for confirmation, open Show logs and follow the terminal prompt.</span></div>}</div><button className="secondary-button" onClick={onShowLogs}><TerminalSquare size={15} /> Show logs</button></div>
}

function ConfigPanel({ onRun, onApplyFull, operation }: { onRun: () => void; onApplyFull: () => void; operation: OperationState }) {
  return <div className="panel-card"><PanelHeader icon={<Settings2 size={22} />} eyebrow="STABLE CONFIGURATION" title="Keep the stable path predictable." detail="The web workflow exposes only official Stable Nix channels. Unstable options are intentionally absent." /><div className="channel-card"><div className="channel-mark">N</div><div><span className="channel-label">CURRENT CHANNEL</span><strong>Not checked</strong><p>Run the check to query the installed official Stable channel.</p></div><span className="state-badge">PENDING</span></div><div className="config-options"><div className="config-option active"><span className="radio-dot" /><div><strong>Official Stable</strong><small>Use the curated channel selected by the project.</small></div><Check size={15} /></div><div className="config-option disabled"><span className="radio-dot" /><div><strong>Unstable</strong><small>Not exposed by Alpine Desktop Center.</small></div><LockKeyhole size={15} /></div></div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />}>Check Stable channel</OperationButton><OperationButton onClick={onApplyFull} operation={operation} icon={<Wrench size={15} />}>Apply full configuration</OperationButton></div></div>
}

function LogsModal({ operation, activeOperation, operationId, logs, onSendInput, onClose }: { operation: OperationState; activeOperation: NamedOperation | null; operationId: string | null; logs: LogEntry[]; onSendInput: (input: string) => Promise<void>; onClose: () => void }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const submitInput = async (event: FormEvent) => {
    event.preventDefault()
    if (!input || !operationId || sending) return
    setSending(true)
    try {
      await onSendInput(`${input}\n`)
      setInput('')
    } finally {
      setSending(false)
    }
  }
  return <div className="logs-modal-backdrop" role="dialog" aria-modal="true" aria-label="Operation logs"><div className="panel-card logs-modal"><div className="inspector-heading"><div><p className="section-kicker">OPERATION LOGS</p><h3>Backend terminal output</h3></div><button className="icon-button" onClick={onClose} aria-label="Close logs"><XCircle size={17} /></button></div><div className="execution-state"><div className={`big-state-icon ${operation}`}><OperationIcon state={operation} size={24} /></div><div><span className="section-kicker">CURRENT STATE</span><strong>{operation === 'running' ? 'Running operation' : operation === 'error' ? 'Operation failed' : operation === 'success' ? 'Operation finished' : 'Waiting for an operation'}</strong><p>Named command: <code>{activeOperation ?? 'none'}</code></p></div></div><div className="terminal"><div className="terminal-bar"><span /><span /><span /><small>activity.log · release namespace</small></div><div className="terminal-body">{logs.map((log, index) => <div className="terminal-line" key={`${log.time}-${index}`}><span className="terminal-time">[{log.time}]</span><span className={`terminal-level ${log.level}`}>{log.level.toUpperCase()}</span><span>{log.text}</span></div>)}{operation === 'running' && <div className="terminal-line live"><LoaderCircle className="spin" size={14} /> Waiting for local operation output…</div>}</div></div>{operation === 'running' && <form className="terminal-input-row" autoComplete="off" onSubmit={submitInput}><input type="password" name="operation-pty-input" autoComplete="new-password" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Senha ou confirmação solicitada pelo backend" aria-label="Terminal input" disabled={!operationId || sending} /><button className="primary-button" type="submit" disabled={!operationId || !input || sending}>{sending ? 'Sending…' : 'Send'}</button></form>}</div></div>
}

function SummaryPanel({ operation, onRestart }: { operation: OperationState; onRestart: () => void }) {
  return <div className="panel-card summary-panel"><div className="summary-icon"><CheckCircle2 size={32} /></div><p className="section-kicker">SESSION SUMMARY</p><h3>{operation === 'success' ? 'The operation completed.' : 'Your workspace is ready to continue.'}</h3><p className="summary-copy">When the local bridge is connected, this page will summarize every applied module, warning and saved audit record. Nothing is hidden behind a generic success message.</p><div className="summary-stats"><Metric label="Operations" value="0 applied" /><Metric label="Warnings" value="0 unresolved" /><Metric label="Audit records" value="2 available" /></div><button className="secondary-button" onClick={onRestart}>Return to overview</button></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

export default App
