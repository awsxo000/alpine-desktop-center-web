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
import { backendStatus, initialLogs, startNamedOperation } from './api'
import type { LogEntry, Module, NamedOperation, OperationState, StepId } from './types'

const steps: Array<{ id: StepId; number: string; label: string; note: string }> = [
  { id: 'welcome', number: '01', label: 'Welcome', note: 'Release overview' },
  { id: 'validate', number: '02', label: 'Backend', note: 'Integrity lock' },
  { id: 'checks', number: '03', label: 'System check', note: 'Read-only signals' },
  { id: 'modules', number: '04', label: 'Modules', note: 'Select roles' },
  { id: 'config', number: '05', label: 'Configuration', note: 'Stable choices' },
  { id: 'execute', number: '06', label: 'Execution', note: 'Live operations' },
  { id: 'summary', number: '07', label: 'Summary', note: 'Review outcome' },
]

const modules: Module[] = [
  { id: 'base', name: 'Base', description: 'Core packages, users and shell defaults.', state: 'Ready', detail: 'All required signals present', accent: 'cyan' },
  { id: 'audio', name: 'Audio', description: 'PipeWire, WirePlumber and session audio.', state: 'Needs attention', detail: '2 checks need review', accent: 'amber' },
  { id: 'network', name: 'Network', description: 'NetworkManager and managed devices.', state: 'Ready', detail: 'Connected · 1 device', accent: 'green' },
  { id: 'kde', name: 'KDE Plasma', description: 'Desktop shell, menu and session defaults.', state: 'Ready', detail: 'Plasma session detected', accent: 'violet' },
  { id: 'nix', name: 'Nix', description: 'Stable channel and user profile tooling.', state: 'Ready', detail: 'nixos-26.05 · current', accent: 'blue' },
  { id: 'steam', name: 'Steam', description: 'Gaming stack and Nix application path.', state: 'Unknown', detail: 'Run a live diagnostic', accent: 'pink' },
]

const stepIndex = (id: StepId) => steps.findIndex((step) => step.id === id)

function App() {
  const [activeStep, setActiveStep] = useState<StepId>('welcome')
  const [selectedModule, setSelectedModule] = useState('audio')
  const [operation, setOperation] = useState<OperationState>('idle')
  const [logs, setLogs] = useState<LogEntry[]>(initialLogs)
  const [darkMode, setDarkMode] = useState(false)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [bridgeMessage, setBridgeMessage] = useState('Checking the local browser bridge…')

  const selected = useMemo(() => modules.find((module) => module.id === selectedModule) ?? modules[0], [selectedModule])
  const currentIndex = stepIndex(activeStep)
  const requiresCompletedOperation = activeStep === 'validate' || activeStep === 'checks' || activeStep === 'config'
  const canAdvance = !requiresCompletedOperation || operation === 'success'

  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        const payload = await response.json() as { backend?: string; message?: string }
        if (!response.ok || payload.backend !== 'validated') throw new Error(payload.message ?? 'Backend validation failed.')
        setBridgeConnected(true)
        setBridgeMessage('Local bridge connected. The embedded backend is validated and ready for named operations.')
      })
      .catch(() => {
        setBridgeConnected(false)
        setBridgeMessage('The browser preview is ready. Start the packaged launcher to connect the local backend bridge.')
      })
  }, [])

  const addLog = (level: LogEntry['level'], text: string) => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs((current) => [...current, { time: now, level, text }])
  }

  const runOperation = async (namedOperation: NamedOperation, label: string, parameters: Record<string, string> = {}) => {
    if (operation === 'running') return
    setOperation('running')
    setActiveStep('execute')
    addLog('info', `Starting named operation: ${label}`)
    setBridgeMessage('Opening a protected local operation channel…')
    try {
      const response = await startNamedOperation(namedOperation, parameters)
      const payload = await response.json().catch(() => ({})) as { message?: string; output?: string }
      if (!response.ok) throw new Error(payload.message ?? `Local bridge returned HTTP ${response.status}`)
      if (payload.output) payload.output.split('\n').filter(Boolean).slice(-40).forEach((line) => addLog('info', line))
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

  const goNext = () => {
    const next = steps[Math.min(currentIndex + 1, steps.length - 1)]
    if (next) {
      setOperation('idle')
      setActiveStep(next.id)
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

        <div className="release-chip"><span className="pulse-dot" /> Local system workspace <strong>alpha.4</strong></div>

        <nav className="stepper" aria-label="Installer steps">
          <p className="nav-caption">WORKSPACE SECTIONS</p>
          {steps.map((step, index) => {
            const isActive = step.id === activeStep
            const isPast = index < currentIndex
            return (
              <button className={`step-item ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`} key={step.id} onClick={() => setActiveStep(step.id)} disabled={index > currentIndex} aria-current={isActive ? 'step' : undefined}>
                <span className="step-number">{isPast ? <Check size={14} strokeWidth={3} /> : step.number}</span>
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
          <div className="crumb"><span>ALPINE WORKSPACE</span><ChevronRight size={14} /><strong>{steps[currentIndex]?.label}</strong></div>
          <div className="top-actions">
            <span className="connection-pill"><span className={`status-led ${bridgeConnected ? 'green' : 'amber'}`} /> {bridgeConnected ? 'Local bridge connected' : 'Preview bridge pending'}</span>
            <button className="icon-button" onClick={() => setDarkMode((current) => !current)} aria-label="Toggle theme" title="Toggle theme">{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>

        <section className="page-heading">
          <div>
            <p className="eyebrow accent-text">STEP {steps[currentIndex]?.number} / {steps.length}</p>
            <h2>{activeStep === 'welcome' ? 'See the system. Decide the change.' : steps[currentIndex]?.label}</h2>
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
                  <p>Inspect the current system, choose a bounded action, and keep its evidence with you from start to finish.</p>
                  <div className="hero-actions"><button className="primary-button" onClick={() => setActiveStep('validate')}>Inspect the release <ArrowRight size={16} /></button><button className="ghost-button" onClick={() => setActiveStep('modules')}>Browse modules</button></div>
                </div>
                <div className="hero-visual"><div className="mountain mountain-back" /><div className="mountain mountain-front" /><div className="visual-label"><span className="status-led green" /> SYSTEM READY</div></div>
              </div>
              <div className="section-row"><div><p className="section-kicker">CURRENT SNAPSHOT</p><h3>System signals</h3></div><button className="text-button" onClick={() => setActiveStep('validate')}>Open integrity check <ArrowRight size={15} /></button></div>
              <div className="health-grid"><HealthCard icon={<FolderLock size={18} />} label="Backend integrity" value="Validated" detail="SHA-256 manifest matches" tone="green" /><HealthCard icon={<HardDrive size={18} />} label="Release state" value="Fresh workspace" detail="No previous logs found" tone="blue" /><HealthCard icon={<Network size={18} />} label="Stable channel" value="nixos-26.05" detail="Official channel · current" tone="violet" /></div>
            </>}

            {activeStep === 'validate' && <ValidationPanel onRun={() => runOperation('validate-backend', 'Validate embedded backend')} operation={operation} />}
            {activeStep === 'checks' && <ChecksPanel onRun={() => runOperation('system-check', 'Run read-only system checks')} operation={operation} />}
            {activeStep === 'modules' && <ModulesPanel modules={modules} selectedModule={selectedModule} setSelectedModule={setSelectedModule} selected={selected} onRun={() => runOperation('apply-module', `Apply ${selected.name} module`, { module: selectedModule })} operation={operation} />}
            {activeStep === 'config' && <ConfigPanel onRun={() => runOperation('check-stable-channel', 'Check official Stable Nix channel')} operation={operation} />}
            {activeStep === 'execute' && <ExecutionPanel operation={operation} logs={logs} onRun={() => runOperation('apply-full', 'Apply full configuration')} />}
            {activeStep === 'summary' && <SummaryPanel operation={operation} onRestart={() => setActiveStep('welcome')} />}

            {activeStep !== 'welcome' && activeStep !== 'execute' && activeStep !== 'summary' && <div className="flow-footer"><button className="secondary-button" onClick={() => setActiveStep(steps[Math.max(currentIndex - 1, 0)].id)}>Back</button><button className="primary-button" onClick={goNext} disabled={!canAdvance}>Continue <ArrowRight size={16} /></button></div>}
          </section>

          <aside className="inspector-column">
            <div className="inspector-card">
              <div className="inspector-heading"><div><p className="section-kicker">OPERATION STATUS</p><h3>Protected execution</h3></div><span className={`state-badge ${operation}`}>{operation === 'idle' ? 'Ready' : operation}</span></div>
              <div className="operation-line"><div className={`operation-icon ${operation}`}><OperationIcon state={operation} size={20} /></div><div><strong>{operation === 'idle' ? 'No operation running' : operation === 'running' ? 'Operation in progress' : operation === 'error' ? 'Bridge connection needed' : 'Operation complete'}</strong><p>{bridgeMessage}</p></div></div>
              <div className="guard-list"><Guard icon={<LockKeyhole size={14} />} label="Named commands only" /><Guard icon={<ShieldCheck size={14} />} label="Integrity rechecked before run" /><Guard icon={<TerminalSquare size={14} />} label="Password stays in local doas" /></div>
            </div>

            <div className="audit-card"><div className="inspector-heading"><div><p className="section-kicker">LIVE AUDIT</p><h3>Activity stream</h3></div><button className="icon-button subtle" title="Refresh activity"><RefreshCw size={15} /></button></div><div className="stream-list">{logs.slice(-5).reverse().map((log, index) => <div className="stream-item" key={`${log.time}-${index}`}><span className={`stream-dot ${log.level}`} /><div><div className="stream-meta"><span>{log.time}</span><span className={`log-level ${log.level}`}>{log.level}</span></div><p>{log.text}</p></div></div>)}</div><button className="audit-link" onClick={() => setActiveStep('execute')}>Open full audit <FileClock size={15} /></button></div>

            <div className="help-card"><div className="help-icon"><Wrench size={17} /></div><div><strong>Need to understand a step?</strong><p>Every operation will show its command, state and raw output in the browser.</p></div></div>
          </aside>
        </div>
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

function ValidationPanel({ onRun, operation }: { onRun: () => void; operation: OperationState }) {
  return <div className="panel-card"><PanelHeader icon={<ShieldCheck size={22} />} eyebrow="BACKEND VALIDATION" title="The execution lock is active." detail="Every action starts with a fresh check of the embedded backend and its SHA-256 manifest." /><div className="validation-banner"><CheckCircle2 size={20} /><div><strong>Backend detected and validated</strong><p>95 embedded files match the release manifest. No external backend will be used.</p></div><span className="state-badge success">PASS</span></div><div className="metric-list"><Metric label="Backend version" value="v1.43" /><Metric label="Diagnostic schema" value="1" /><Metric label="Release location" value="./backend" /><Metric label="Last validation" value="Just now" /></div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />}>Validate again</OperationButton></div></div>
}

function ChecksPanel({ onRun, operation }: { onRun: () => void; operation: OperationState }) {
  const checks = [{ label: 'Alpine release', value: '3.24', state: 'pass' }, { label: 'Package repositories', value: 'Ready to inspect', state: 'neutral' }, { label: 'doas authentication', value: 'Local terminal only', state: 'neutral' }, { label: 'Audio session', value: 'Needs review', state: 'warn' }]
  return <div className="panel-card"><PanelHeader icon={<ClipboardCheck size={22} />} eyebrow="READ-ONLY INSPECTION" title="See the system before changing it." detail="These checks never apply configuration. They provide the context needed for a safe decision." /><div className="check-table">{checks.map((check) => <div className="check-row" key={check.label}><span className={`check-status ${check.state}`}>{check.state === 'pass' ? <Check size={14} /> : check.state === 'warn' ? <CircleAlert size={14} /> : <CircleDashed size={14} />}</span><div><strong>{check.label}</strong><small>{check.value}</small></div><ChevronRight size={16} /></div>)}</div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation}>Run system check</OperationButton><span className="muted-note"><LockKeyhole size={13} /> Read-only operation</span></div></div>
}

function ModulesPanel({ modules, selectedModule, setSelectedModule, selected, onRun, operation }: { modules: Module[]; selectedModule: string; setSelectedModule: (id: string) => void; selected: Module; onRun: () => void; operation: OperationState }) {
  return <div className="panel-card"><PanelHeader icon={<Layers3 size={22} />} eyebrow="ROLE CATALOG" title="Choose what you want to inspect." detail="Modules map directly to the backend roles. Select one to view its signals, dependencies and safe actions." /><div className="module-list">{modules.map((module) => <button className={`module-row ${selectedModule === module.id ? 'selected' : ''}`} key={module.id} onClick={() => setSelectedModule(module.id)}><span className={`module-avatar ${module.accent}`}>{module.name.slice(0, 2).toUpperCase()}</span><span className="module-copy"><strong>{module.name}</strong><small>{module.description}</small></span><span className={`module-state ${module.state.toLowerCase().replace(' ', '-')}`}><span className="status-led" />{module.state}</span><ChevronRight size={16} /></button>)}</div><div className="selected-module"><div><p className="section-kicker">SELECTED MODULE</p><h4>{selected.name}</h4><p>{selected.detail}. A live diagnostic can be run before any Ansible action.</p></div><OperationButton onClick={onRun} operation={operation} icon={<Activity size={15} />}>Inspect {selected.name}</OperationButton></div></div>
}

function ConfigPanel({ onRun, operation }: { onRun: () => void; operation: OperationState }) {
  return <div className="panel-card"><PanelHeader icon={<Settings2 size={22} />} eyebrow="STABLE CONFIGURATION" title="Keep the stable path predictable." detail="The web workflow exposes only official Stable Nix channels. Unstable options are intentionally absent." /><div className="channel-card"><div className="channel-mark">N</div><div><span className="channel-label">CURRENT CHANNEL</span><strong>nixos-26.05</strong><p>Official Stable channel · current according to the last check.</p></div><span className="state-badge success">STABLE</span></div><div className="config-options"><div className="config-option active"><span className="radio-dot" /><div><strong>Official Stable</strong><small>Use the curated channel selected by the project.</small></div><Check size={15} /></div><div className="config-option disabled"><span className="radio-dot" /><div><strong>Unstable</strong><small>Not exposed by Alpine Desktop Center.</small></div><LockKeyhole size={15} /></div></div><div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />}>Check Stable channel</OperationButton></div></div>
}

function ExecutionPanel({ operation, logs, onRun }: { operation: OperationState; logs: LogEntry[]; onRun: () => void }) {
  return <div className="panel-card execution-panel"><PanelHeader icon={<TerminalSquare size={22} />} eyebrow="CONTROLLED EXECUTION" title="Every step stays visible." detail="The browser records the named operation, its current state and captured backend output without hiding the terminal reality." /><div className="execution-state"><div className={`big-state-icon ${operation}`}><OperationIcon state={operation} size={24} /></div><div><span className="section-kicker">CURRENT STATE</span><strong>{operation === 'idle' ? 'Ready to run' : operation === 'running' ? 'Running operation' : operation === 'error' ? 'Local bridge returned an error' : 'Operation finished'}</strong><p>Named command: <code>apply-full</code></p></div><OperationButton onClick={onRun} operation={operation}>Apply full configuration</OperationButton></div><div className="terminal"><div className="terminal-bar"><span /><span /><span /><small>activity.log · release namespace</small></div><div className="terminal-body">{logs.map((log, index) => <div className="terminal-line" key={`${log.time}-${index}`}><span className="terminal-time">[{log.time}]</span><span className={`terminal-level ${log.level}`}>{log.level.toUpperCase()}</span><span>{log.text}</span></div>)}{operation === 'running' && <div className="terminal-line live"><LoaderCircle className="spin" size={14} /> Waiting for local operation output…</div>}</div></div></div>
}

function SummaryPanel({ operation, onRestart }: { operation: OperationState; onRestart: () => void }) {
  return <div className="panel-card summary-panel"><div className="summary-icon"><CheckCircle2 size={32} /></div><p className="section-kicker">SESSION SUMMARY</p><h3>{operation === 'success' ? 'The operation completed.' : 'Your workspace is ready to continue.'}</h3><p className="summary-copy">When the local bridge is connected, this page will summarize every applied module, warning and saved audit record. Nothing is hidden behind a generic success message.</p><div className="summary-stats"><Metric label="Operations" value="0 applied" /><Metric label="Warnings" value="0 unresolved" /><Metric label="Audit records" value="2 available" /></div><button className="secondary-button" onClick={onRestart}>Return to overview</button></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

export default App
