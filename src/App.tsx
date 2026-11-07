import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import logoMark from '../alpine-desktop-center.svg'
import {
  Activity,
  ArrowRight,
  Bluetooth,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleDashed,
  ClipboardCheck,
  FileClock,
  FolderLock,
  Gamepad2,
  HardDrive,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Moon,
  Network,
  Package,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Sun,
  TerminalSquare,
  Type,
  Volume2,
  Wrench,
  Zap,
  XCircle,
} from 'lucide-react'
import { getBridgeHealth, getDesktopEnvironment, getModuleCatalog, getNixSupport, getOperationHistory, getOperationUpdate, getPersistedStableChannelStatus, getSavedOperationLog, startNamedOperation } from './api'
import { copy, formatDate, initialLocale, type Locale } from './i18n'
import type { BridgeHealth, DesktopEnvironment, LogEntry, Module, NixApp, ModuleDiagnostic, ModuleState, NamedOperation, NixSupport, OperationLogSummary, OperationState, SavedOperationLog, StableChannelReport, StepId } from './types'

const steps: Array<{ id: StepId }> = [
  { id: 'welcome' }, { id: 'verify' }, { id: 'apply' }, { id: 'nix' }, { id: 'history' },
]

const CopyContext = createContext({ ui: copy['en-US'], locale: 'en-US' as Locale })
const useCopy = () => useContext(CopyContext)

type OperationRecord = {
  label: string
  operation: NamedOperation
  status: 'success' | 'error' | 'blocked'
  time: string
}

type StableChannelCheck = { status: 'success' | 'error' | 'blocked' | 'unknown'; output: string; report: StableChannelReport | null; checkedAt: number; logId?: string | null; logPath?: string | null }

type PendingOperation = {
  operation: NamedOperation
  label: string
  parameters: Record<string, string>
  targetStep?: StepId
}

const moduleIcons: Record<Module['id'], ReactNode> = {
  base: <Package size={17} strokeWidth={1.8} />,
  audio: <Volume2 size={17} strokeWidth={1.8} />,
  energia: <Zap size={17} strokeWidth={1.8} />,
  fontes: <Type size={17} strokeWidth={1.8} />,
  kde: <Settings2 size={17} strokeWidth={1.8} />,
  bluetooth: <Bluetooth size={17} strokeWidth={1.8} />,
  rede: <Network size={17} strokeWidth={1.8} />,
  nix: <Snowflake size={17} strokeWidth={1.8} />,
  nix_opengl: <Sparkles size={17} strokeWidth={1.8} />,
  steam: <Gamepad2 size={17} strokeWidth={1.8} />,
  swap: <HardDrive size={17} strokeWidth={1.8} />,
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
  const stableCheckRevision = useRef(0)
  const historyRevision = useRef(0)
  const [activeStep, setActiveStep] = useState<StepId>('welcome')
  const [moduleCatalog, setModuleCatalog] = useState<Module[]>([])
  const [moduleCatalogStatus, setModuleCatalogStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [moduleStates, setModuleStates] = useState<Record<string, ModuleState>>({})
  const [diagnostics, setDiagnostics] = useState<Record<string, ModuleDiagnostic>>({})
  const [selectedModule, setSelectedModule] = useState('audio')
  const [operation, setOperation] = useState<OperationState>('idle')
  const [activeOperation, setActiveOperation] = useState<NamedOperation | null>(null)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [activeLogPath, setActiveLogPath] = useState<string | null>(null)
  const [operationRecords, setOperationRecords] = useState<OperationRecord[]>([])
  const [stableChannelCheck, setStableChannelCheck] = useState<StableChannelCheck | null>(null)
  const [stableMigrationStale, setStableMigrationStale] = useState(true)
  const [nixApps, setNixApps] = useState<NixApp[]>([])
  const [backendCheckedAt, setBackendCheckedAt] = useState<number | null>(null)
  const [operationHistory, setOperationHistory] = useState<OperationLogSummary[]>([])
  const [historyRefreshing, setHistoryRefreshing] = useState(false)
  const [selectedSavedLog, setSelectedSavedLog] = useState<SavedOperationLog | null>(null)
  const [savedLogLoading, setSavedLogLoading] = useState(false)
  const [savedLogError, setSavedLogError] = useState('')
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [darkMode, setDarkMode] = useState(false)
  const [locale, setLocale] = useState<Locale>(() => initialLocale())
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealth | null>(null)
  const [bridgeMessage, setBridgeMessage] = useState(() => copy[initialLocale()].messages.checkingBridge)
  const [desktopEnvironment, setDesktopEnvironment] = useState<DesktopEnvironment | null>(null)
  const [nixSupport, setNixSupport] = useState<NixSupport | null>(null)
  const [startupReady, setStartupReady] = useState(false)

  const ui = copy[locale]
  const currentSection = steps.find((step) => step.id === activeStep) ?? steps[0]
  const currentSectionText = ui.nav[currentSection.id]
  const selected = useMemo(() => moduleCatalog.find((module) => module.id === selectedModule) ?? moduleCatalog[0] ?? null, [moduleCatalog, selectedModule])
  const canExecute = bridgeConnected && bridgeHealth?.backend === 'validated' && bridgeHealth?.diagnostic_schema === '1'
  const stableCheckAge = stableChannelCheck ? Date.now() - stableChannelCheck.checkedAt : Number.POSITIVE_INFINITY
  const canMigrateStable = Boolean(!stableMigrationStale && stableChannelCheck?.status === 'success' && stableChannelCheck.report?.status === 'update_available' && stableCheckAge >= 0 && stableCheckAge <= 10 * 60_000)
  const selectedDiagnostic = selected ? diagnostics[selected.id] : undefined
  const dependencyBlockers = (selected?.dependencies ?? []).filter((id) => {
    const diagnostic = diagnostics[id]
    return !isDiagnosticFresh(diagnostic) || diagnostic.status !== 'complete'
  })
  const applyBlockReason = !canExecute
    ? ui.apply.blockBackend
    : moduleCatalogStatus === 'loading'
      ? ui.apply.catalogLoading
      : moduleCatalogStatus === 'unavailable' || !selected
        ? ui.apply.catalogUnavailable
        : !isDiagnosticFresh(selectedDiagnostic)
          ? ui.apply.checkFirst
          : selectedDiagnostic?.status === 'unknown'
            ? ui.apply.unknownDiagnostic
            : !diagnosticMatchesCatalog(selected, selectedDiagnostic)
              ? ui.apply.catalogMismatch
              : dependencyBlockers.length
                ? ui.apply.dependencyBlockers(dependencyBlockers.map((id) => ui.modules.names[id]).join(', '))
                : ''
  const canApplySelected = Boolean(selected && !applyBlockReason)

  useEffect(() => {
    let active = true
    const initialStableRevision = stableCheckRevision.current
    const initialHistoryRevision = historyRevision.current
    void getDesktopEnvironment()
      .then((detected) => { if (active) setDesktopEnvironment(detected) })
      .catch(() => { if (active) setDesktopEnvironment({ id: 'unknown', name: ui.welcome.startupUnknown, sessionType: 'unknown', detectionSource: 'unavailable', capabilities: [] }) })
    void getNixSupport()
      .then((support) => { if (active) setNixSupport(support) })
      .catch(() => { if (active) setNixSupport({ supported: false, nixEnv: false, stableChannel: false, version: null, reason: 'Classic Nix support could not be detected.' }) })
    void getBridgeHealth()
      .then((payload) => {
        if (!active) return
        setBridgeHealth(payload)
        setBridgeConnected(true)
        setBackendCheckedAt(Date.now())
        setBridgeMessage(payload.diagnostic_schema === '1' ? payload.message : ui.messages.unsupportedSchema(payload.diagnostic_schema))
      })
      .catch((error) => {
        if (!active) return
        setBridgeConnected(false)
        setBridgeHealth(null)
        setBackendCheckedAt(Date.now())
        setBridgeMessage(error instanceof Error ? error.message : copy[initialLocale()].messages.bridgeUnavailable)
      })
    void getModuleCatalog()
      .then((catalog) => { if (active) { setModuleCatalog(catalog); setModuleCatalogStatus(catalog.length ? 'ready' : 'unavailable') } })
      .catch((error) => { if (active) { setModuleCatalogStatus('unavailable'); setBridgeMessage(error instanceof Error ? error.message : copy[initialLocale()].messages.catalogUnavailable) } })
    void getOperationHistory()
      .then((history) => { if (active && historyRevision.current === initialHistoryRevision) setOperationHistory(history) })
      .catch(() => { if (active && historyRevision.current === initialHistoryRevision) setOperationHistory([]) })
    void getPersistedStableChannelStatus()
      .then((persisted) => {
        if (!active || stableCheckRevision.current !== initialStableRevision || !persisted.checked) return
        const checkedAt = persisted.checked_at ? Date.parse(persisted.checked_at) : Number.NaN
        setStableChannelCheck({
          status: persisted.status === 'success' || persisted.status === 'error' || persisted.status === 'blocked' ? persisted.status : 'unknown',
          output: persisted.message,
          report: persisted.report,
          checkedAt: Number.isFinite(checkedAt) ? checkedAt : Date.now(),
          logId: persisted.log_id,
          logPath: persisted.log_path,
        })
      })
      .catch(() => { /* The bridge is unavailable, so no persisted status can be loaded yet. */ })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setFreshnessTick((tick) => tick + 1), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('alpine-desktop-center-locale', locale)
    document.documentElement.lang = locale
    document.title = ui.documentTitle
  }, [locale, ui.documentTitle])

  useEffect(() => {
    if (!startupReady && desktopEnvironment && nixSupport && backendCheckedAt !== null && moduleCatalogStatus !== 'loading') setStartupReady(true)
  }, [startupReady, desktopEnvironment, nixSupport, backendCheckedAt, moduleCatalogStatus])

  const addLog = (level: LogEntry['level'], text: string) => {
    const now = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs((current) => [...current, { time: now, level, text }].slice(-1000))
  }

  const refreshOperationHistory = async () => {
    const requestRevision = ++historyRevision.current
    setHistoryRefreshing(true)
    try {
      const history = await getOperationHistory()
      if (historyRevision.current === requestRevision) setOperationHistory(history)
    } catch (error) {
      if (historyRevision.current === requestRevision) addLog('error', ui.messages.historyRefreshFailed(error instanceof Error ? error.message : ui.history.noLogs))
    } finally {
      if (historyRevision.current === requestRevision) setHistoryRefreshing(false)
    }
  }

  const openSavedLog = async (entry: OperationLogSummary) => {
    setSelectedSavedLog({ ...entry, content: '' })
    setSavedLogError('')
    setSavedLogLoading(true)
    try {
      setSelectedSavedLog(await getSavedOperationLog(entry.id))
    } catch (error) {
      setSavedLogError(error instanceof Error ? error.message : ui.savedLog.readError)
    } finally {
      setSavedLogLoading(false)
    }
  }

  const saveRecord = (namedOperation: NamedOperation, label: string, status: OperationRecord['status']) => {
    const time = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setOperationRecords((current) => [...current, { label, operation: namedOperation, status, time }].slice(-500))
  }

  const runOperation = async (namedOperation: NamedOperation, label: string, parameters: Record<string, string> = {}, targetStep?: StepId) => {
    if (operation === 'running') return
    if (namedOperation === 'check-stable-channel' || namedOperation === 'simulate-full' || namedOperation === 'refresh-nix-apps' || namedOperation === 'update-nix-apps' || namedOperation === 'migrate-stable-channel' || namedOperation.startsWith('apply-')) setStableMigrationStale(true)
    if (namedOperation !== 'validate-backend' && !canExecute) {
      setOperation('blocked')
      setBridgeMessage(ui.messages.blockedBackend)
      addLog('warning', ui.messages.blockedLabel(label))
      saveRecord(namedOperation, label, 'blocked')
      setLogsOpen(true)
      return
    }
    setOperation('running')
    setLogsOpen(true)
    setActiveOperation(namedOperation)
    setOperationId(null)
    setActiveLogPath(null)
    if (targetStep) setActiveStep(targetStep)
    addLog('info', ui.messages.startingOperation(label))
    setBridgeMessage(ui.messages.openingChannel)
    try {
      const response = await startNamedOperation(namedOperation, parameters)
      const payload = await response.json().catch(() => ({})) as { message?: string; operation_id?: string; status?: string }
      if (!response.ok) {
        if (payload.status === 'blocked') {
          setOperation('blocked')
          setBridgeMessage(ui.messages.operationBlocked(payload.message ?? ui.inspector.operationBlocked))
          addLog('warning', ui.messages.operationBlocked(payload.message ?? ui.inspector.operationBlocked))
          saveRecord(namedOperation, label, 'blocked')
          return
        }
        throw new Error(payload.message ?? ui.messages.httpError(response.status))
      }
      if (!payload.operation_id) throw new Error(ui.messages.missingSession)
      if (namedOperation.startsWith('apply-') || namedOperation === 'refresh-nix-apps' || namedOperation === 'update-nix-apps' || namedOperation === 'migrate-stable-channel') {
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
        if (update.nix_apps !== undefined) setNixApps(update.nix_apps)
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
              setBackendCheckedAt(Date.now())
              setBridgeMessage(health.diagnostic_schema === '1' ? health.message : ui.messages.unsupportedSchema(health.diagnostic_schema))
              try {
                const catalog = await getModuleCatalog()
                setModuleCatalog(catalog)
                setModuleCatalogStatus(catalog.length ? 'ready' : 'unavailable')
              } catch (catalogError) {
                setModuleCatalog([])
                setModuleCatalogStatus('unavailable')
                addLog('warning', `${ui.verify.catalogUnavailable} ${catalogError instanceof Error ? catalogError.message : ''}`.trim())
              }
            } catch (healthError) {
              setBridgeHealth(null)
              setBridgeConnected(false)
              setBackendCheckedAt(Date.now())
              setBridgeMessage(healthError instanceof Error ? ui.messages.validationRecheckFailed(healthError.message) : ui.verify.validationUnavailable)
            }
          }
          if (namedOperation === 'check-stable-channel') {
            const report = parseStableChannelReport(capturedOutput)
            stableCheckRevision.current += 1
            setStableChannelCheck({ status: update.status, output: capturedOutput, report, checkedAt: Date.now(), logId: payload.operation_id, logPath: update.log_path ?? null })
            setStableMigrationStale(!(update.status === 'success' && report?.status === 'update_available'))
          }
          const recordStatus = update.status
          saveRecord(namedOperation, label, recordStatus)
          addLog(recordStatus === 'success' ? 'success' : recordStatus === 'blocked' ? 'warning' : 'error', ui.messages.operationComplete(label, update.message))
          void refreshOperationHistory()
          return
        }
      }
      throw new Error(ui.messages.deadline)
    } catch (error) {
      setOperation('error')
      const detail = error instanceof Error ? error.message : ui.messages.bridgeUnavailable
      setBridgeMessage(detail)
      if (error instanceof TypeError) setBridgeConnected(false)
      addLog('error', ui.messages.operationFailed(label, detail))
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
      const message = ui.messages.migrationNotAllowed
      setOperation('blocked')
      setBridgeMessage(message)
      addLog('warning', `${label} was blocked: ${message}`)
      saveRecord(namedOperation, label, 'blocked')
      return
    }
    if (!canExecute) {
      setOperation('blocked')
      setBridgeMessage(ui.messages.blockedBackend)
      addLog('warning', ui.messages.blockedLabel(label))
      saveRecord(namedOperation, label, 'blocked')
      return
    }
    const needsConfirmation = namedOperation === 'simulate-full' || namedOperation.startsWith('apply-') || namedOperation === 'migrate-stable-channel' || namedOperation === 'refresh-nix-apps' || namedOperation === 'update-nix-apps' || namedOperation === 'refresh-kde-apps' || namedOperation === 'uninstall-nix-app' || namedOperation === 'collect-nix-garbage'
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
      const refreshed = update.output.split('\n').filter(Boolean).map((text) => ({ time: new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' }), level: 'info' as const, text }))
      setLogs(refreshed)
      addLog(update.status === 'running' ? 'info' : update.status === 'success' ? 'success' : 'warning', `${ui.inspector.operationStatus}: ${ui.states.operation[update.status]}.`)
    } catch (error) {
      addLog('error', ui.messages.outputRefreshFailed(error instanceof Error ? error.message : ui.logs.noOutput))
    }
  }

  const systemDiagnostics = Object.values(diagnostics)
  const stableHomeLabel = activeOperation === 'check-stable-channel' && operation === 'running' ? ui.states.operation.running
    : stableChannelCheck?.status === 'error' ? ui.welcome.stableCheckFailed
      : stableChannelCheck?.status === 'blocked' ? ui.welcome.stableBlocked
        : stableChannelCheck?.report?.status === 'current' ? ui.welcome.stableUpToDate
          : stableChannelCheck?.report?.status === 'update_available' ? ui.welcome.stableUpdateAvailable
            : stableChannelCheck ? ui.welcome.stableUnknown : ui.welcome.stableNotChecked
  const stableHomeDetail = stableChannelCheck
    ? `${ui.welcome.lastVerification}: ${formatDate(stableChannelCheck.checkedAt, locale)} · ${ui.welcome.latestStable}: ${stableChannelCheck.report?.latest_version ?? '—'}`
    : ui.welcome.noStableCheck

  if (!startupReady) return <StartupScreen environment={desktopEnvironment} bridgeChecked={backendCheckedAt !== null} catalogReady={moduleCatalogStatus !== 'loading'} />

  return (
    <CopyContext.Provider value={{ ui, locale }}>
    <div className={darkMode ? 'app-shell dark' : 'app-shell light'}>
      <aside className="sidebar">
        <div className="brand-lockup">
          <img className="brand-mark" src={logoMark} alt="" aria-hidden="true" />
          <div><p className="eyebrow">ALPINE LINUX</p><h1>Desktop Center</h1></div>
        </div>
        <nav className="stepper" aria-label={ui.chrome.workspaceSections}>
          <p className="nav-caption">{ui.chrome.workspaceSections}</p>
          {steps.filter((step) => step.id !== 'nix' || nixSupport?.supported).map((step) => {
            const isActive = step.id === activeStep
            return <button className={`step-item ${isActive ? 'active' : ''}`} key={step.id} onClick={() => setActiveStep(step.id)} aria-current={isActive ? 'page' : undefined}>
              <span className="step-copy"><strong>{ui.nav[step.id].label}</strong><small>{ui.nav[step.id].note}</small></span>{isActive && <ChevronRight size={15} className="step-arrow" />}
            </button>
          })}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="crumb"><span>{ui.chrome.alpineWorkspace}</span><ChevronRight size={14} /><strong>{currentSectionText.label}</strong></div>
          <div className="top-actions">
            {desktopEnvironment && <span className="desktop-pill" title={desktopEnvironment.detectionSource}>{desktopEnvironment.name}</span>}
            <span className="connection-pill"><span className={`status-led ${canExecute ? 'green' : 'amber'}`} /> {bridgeConnected ? (canExecute ? ui.chrome.localBridgeValidated : ui.chrome.bridgeBlocked) : ui.chrome.bridgeOffline}</span>
            <label className="language-picker"><span className="sr-only">{ui.language}</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} aria-label={ui.language} title={locale === 'pt-BR' ? ui.languagePtFull : ui.languageEnFull}><option value="pt-BR" aria-label={ui.languagePtFull}>{ui.languagePt}</option><option value="en-US" aria-label={ui.languageEnFull}>{ui.languageEn}</option></select></label>
            <button className="icon-button" onClick={() => setDarkMode((current) => !current)} aria-label={ui.chrome.toggleTheme} title={ui.chrome.toggleTheme}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>

        {activeStep !== 'welcome' && <section className={`page-heading page-heading-${activeStep}`}>
          <div>
            <p className="eyebrow accent-text">{ui.nav[activeStep].note}</p>
            <h2>{ui.pages[activeStep].heading}</h2>
            <p className="lede">{ui.pages[activeStep].lede}</p>
          </div>
        </section>}

        <div className="content-grid single-column">
          <section className="primary-column">
            {activeStep === 'welcome' && <>
              <div className="hero-card">
                <div className="hero-content">
                  <div className="welcome-intro">
                    <div className="hero-kicker"><span className="icon-square"><Layers3 size={17} /></span> {ui.welcome.systemWorkspace} <span className="line" /></div>
                    <h3>{ui.welcome.heroTitle} <em>{ui.welcome.heroTitleAccent}</em></h3>
                    <p>{ui.welcome.heroDescription}</p>
                    <div className="hero-actions"><button className="primary-button" onClick={() => setActiveStep('verify')}>{ui.welcome.inspectRelease} <ArrowRight size={16} /></button><button className="ghost-button" onClick={() => setActiveStep('apply')}>{ui.welcome.browseModules}</button></div>
                  </div>
                  <div className="welcome-purpose" aria-label={ui.welcome.purposeLabel}>
                    <p className="purpose-label">{ui.welcome.purposeLabel}</p>
                    <div className="purpose-item"><span className="purpose-icon"><ShieldCheck size={16} /></span><div><strong>{ui.welcome.purposeBaseTitle}</strong><small>{ui.welcome.purposeBaseDescription}</small></div></div>
                    <div className="purpose-item"><span className="purpose-icon"><Layers3 size={16} /></span><div><strong>{ui.welcome.purposeModulesTitle}</strong><small>{ui.welcome.purposeModulesDescription}</small></div></div>
                    <p className="purpose-note"><CheckCircle2 size={14} /> {ui.welcome.scopeNote}</p>
                  </div>
                </div>
              </div>
              <div className="section-row"><div><p className="section-kicker">{ui.welcome.currentSnapshot}</p><h3>{ui.welcome.systemSignals}</h3></div><button className="text-button" onClick={() => setActiveStep('verify')}>{ui.welcome.openSystemCheck} <ArrowRight size={15} /></button></div>
              <div className="health-grid">
                <HealthCard icon={<FolderLock size={18} />} label={ui.welcome.backendIntegrity} value={canExecute ? ui.welcome.validated : bridgeConnected ? ui.welcome.blocked : backendCheckedAt ? ui.welcome.unavailable : ui.chrome.unknown} detail={backendCheckedAt ? `${ui.welcome.lastVerification}: ${formatDate(backendCheckedAt, locale)}` : ui.verify.notValidated} tone={canExecute ? 'green' : 'blue'} action={<button className="health-card-log-link" onClick={() => setActiveStep('verify')}>{ui.welcome.openSystemCheck} <ArrowRight size={13} /></button>} />
                <HealthCard icon={<Network size={18} />} label={ui.welcome.stableChannel} value={stableHomeLabel} detail={stableHomeDetail} tone="violet" action={<button className="health-card-log-link" onClick={() => setActiveStep('nix')}>{ui.welcome.openNix} <ArrowRight size={13} /></button>} />
              </div>
              <section className="workspace-overview" aria-label={ui.welcome.workspaceOverview}>
                <div className="workspace-overview-heading"><p className="section-kicker">{ui.welcome.workspaceOverview}</p><span>{moduleCatalog.length || systemDiagnostics.length || operationHistory.length ? ui.history.currentSession : ui.welcome.overviewEmpty}</span></div>
                <div className="workspace-metrics">
                  <WorkspaceMetric icon={<Layers3 size={16} />} label={ui.welcome.availableModules} value={moduleCatalog.length ? String(moduleCatalog.length) : '—'} detail={moduleCatalog.length ? ui.apply.title : ui.verify.catalogLoading} />
                  <WorkspaceMetric icon={<Activity size={16} />} label={ui.welcome.diagnosticsSession} value={systemDiagnostics.length ? String(systemDiagnostics.length) : '—'} detail={systemDiagnostics.length ? ui.verify.checksTitle : ui.verify.notChecked} />
                  <WorkspaceMetric icon={<FileClock size={16} />} label={ui.welcome.savedOperations} value={operationHistory.length ? String(operationHistory.length) : '—'} detail={operationHistory.length ? ui.history.savedLogs : ui.welcome.overviewEmpty} />
                </div>
              </section>
            </>}

            {activeStep === 'verify' && <>
              <ValidationPanel onRun={() => void runOperation('validate-backend', ui.verify.validateAgain, {}, 'verify')} operation={operation} connected={canExecute} message={bridgeMessage} backendVersion={bridgeHealth?.backend_version ?? ui.chrome.unknown} frontendVersion={bridgeHealth?.frontend_version ?? ui.chrome.unknown} releasePath={bridgeHealth?.release_root ?? ui.chrome.unknown} />
              <ChecksPanel modules={moduleCatalog.map((module) => moduleStates[module.id] ? { ...module, state: moduleStates[module.id] } : module)} catalogStatus={moduleCatalogStatus} diagnostics={systemDiagnostics} operation={operation} activeOperation={activeOperation} canExecute={canExecute} onRunAll={() => void runOperation('check-all-modules', ui.verify.checkAll, {}, 'verify')} onCheckModule={(module) => void runOperation('diagnose-module', `${ui.verify.checkOne}: ${ui.modules.names[module.id]}`, { module: module.id }, 'verify')} />
            </>}
            {activeStep === 'apply' && <ModulesPanel modules={moduleCatalog.map((module) => moduleStates[module.id] ? { ...module, state: moduleStates[module.id] } : module)} catalogStatus={moduleCatalogStatus} selectedModule={selected?.id ?? ''} setSelectedModule={setSelectedModule} selected={selected} selectedDiagnostic={selectedDiagnostic} applyBlockReason={applyBlockReason} onPreview={() => requestOperation('simulate-full', ui.apply.previewConfiguration, {}, 'apply')} onApply={() => selected && requestOperation('apply-module', `${ui.apply.applyModule}: ${ui.modules.names[selected.id]}`, { module: selected.id }, 'apply')} onApplyAll={() => requestOperation('apply-full', ui.apply.applyAll, {}, 'apply')} operation={operation} activeOperation={activeOperation} onShowLogs={() => setLogsOpen(true)} canExecute={canExecute} canApply={canApplySelected} />}
            {activeStep === 'nix' && <ConfigPanel apps={nixApps} onRun={() => void runOperation('check-stable-channel', ui.nix.checkChannel, {}, 'nix')} onListApps={() => void runOperation('list-nix-apps', ui.nix.listApps, {}, 'nix')} onUninstallApp={(app) => requestOperation('uninstall-nix-app', `${ui.nix.uninstallApp}: ${app.name}`, { name: app.name }, 'nix')} onCollectGarbage={() => requestOperation('collect-nix-garbage', ui.nix.collectGarbage, {}, 'nix')} onUpdateNixApps={() => void runOperation('update-nix-apps', ui.nix.updateApps, {}, 'nix')} onRefreshKdeApps={() => void runOperation('refresh-kde-apps', ui.nix.refreshApps, {}, 'nix')} onMigrateStable={() => requestOperation('migrate-stable-channel', ui.nix.migrateStable, {}, 'nix')} operation={operation} canExecute={canExecute} stableChannelCheck={stableChannelCheck} canMigrateStable={canMigrateStable} />}
            {activeStep === 'history' && <SummaryPanel operation={operation} records={operationRecords} history={operationHistory} historyRefreshing={historyRefreshing} onRefreshHistory={() => void refreshOperationHistory()} onOpenLog={(entry) => void openSavedLog(entry)} onGoVerify={() => setActiveStep('verify')} onGoApply={() => setActiveStep('apply')} />}
          </section>
        </div>
        {logsOpen && <LogsModal operation={operation} activeOperation={activeOperation} logs={logs} persistentLogPath={activeLogPath} onRefresh={() => void refreshActivity()} onClose={() => setLogsOpen(false)} />}
        {selectedSavedLog && <SavedLogModal entry={selectedSavedLog} loading={savedLogLoading} error={savedLogError} onClose={() => setSelectedSavedLog(null)} />}
        {pendingOperation && <ConfirmationModal pending={pendingOperation} module={moduleCatalog.find((item) => item.id === pendingOperation.parameters.module)} onConfirm={confirmPendingOperation} onCancel={() => setPendingOperation(null)} />}
      </main>
    </div>
    </CopyContext.Provider>
  )
}

function OperationIcon({ state, size = 20 }: { state: OperationState; size?: number }) {
  const Icon = { idle: CircleDashed, running: LoaderCircle, waiting: CircleAlert, success: CheckCircle2, error: XCircle, blocked: LockKeyhole }[state]
  return <Icon size={size} />
}

function HealthCard({ icon, label, value, detail, tone, action }: { icon: ReactNode; label: string; value: string; detail: string; tone: string; action?: ReactNode }) {
  return <div className="health-card"><div className="health-card-top"><div className={`card-icon ${tone}`}>{icon}</div>{action}</div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div>
}

function WorkspaceMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return <div className="workspace-metric"><span className="workspace-metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div>
}

function PanelHeader({ icon, eyebrow, title, detail }: { icon: ReactNode; eyebrow: string; title: string; detail: string }) {
  return <div className="panel-header"><div className="panel-icon">{icon}</div><div><p className="section-kicker">{eyebrow}</p><h3>{title}</h3><p>{detail}</p></div></div>
}

function OperationButton({ children, onClick, operation, icon = <Play size={15} />, disabled = false }: { children: ReactNode; onClick: () => void; operation: OperationState; icon?: ReactNode; disabled?: boolean }) {
  const isRunning = operation === 'running'
  return <button className={`primary-button${isRunning ? ' is-running' : ''}`} onClick={onClick} disabled={isRunning || disabled} aria-busy={isRunning}>{isRunning ? <LoaderCircle className="spin" size={15} /> : icon}{children}</button>
}

function ValidationPanel({ onRun, operation, connected, message, backendVersion, frontendVersion, releasePath }: { onRun: () => void; operation: OperationState; connected: boolean; message: string; backendVersion: string; frontendVersion: string; releasePath: string }) {
  const { ui } = useCopy()
  return <div className="panel-card validation-panel">
    <PanelHeader icon={<ShieldCheck size={22} />} eyebrow={ui.verify.validationEyebrow} title={ui.verify.validationTitle} detail={ui.verify.validationDetail} />
    <div className={`validation-banner ${connected ? '' : 'invalid'}`}>
      {connected ? <CheckCircle2 size={20} /> : <CircleAlert size={20} />}
      <div><strong>{connected ? ui.verify.backendDetected : ui.verify.validationUnavailable}</strong><p>{connected ? ui.chrome.localBridgeValidated : ui.messages.bridgeUnavailable}</p><details><summary>{ui.inspector.backendDetails}</summary><p>{message}</p></details></div>
      <span className={`state-badge ${connected ? 'success' : 'blocked'}`}>{connected ? ui.verify.pass : ui.verify.blocked}</span>
    </div>
    <div className="metric-list"><Metric label={ui.verify.backendVersion} value={backendVersion} /><Metric label={ui.verify.frontendVersion} value={frontendVersion} /><Metric label={ui.verify.releaseLocation} value={releasePath} /><Metric label={ui.verify.lastValidation} value={connected ? ui.verify.currentSession : ui.verify.notValidated} /></div>
    <div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />}>{ui.verify.validateAgain}</OperationButton></div>
  </div>
}

function ChecksPanel({ modules, catalogStatus, diagnostics, operation, activeOperation, canExecute, onRunAll, onCheckModule }: { modules: Module[]; catalogStatus: 'loading' | 'ready' | 'unavailable'; diagnostics: ModuleDiagnostic[]; operation: OperationState; activeOperation: NamedOperation | null; canExecute: boolean; onRunAll: () => void; onCheckModule: (module: Module) => void }) {
  const { ui, locale } = useCopy()
  const diagnosticByModule = new Map(diagnostics.map((diagnostic) => [diagnostic.module, diagnostic]))
  return <div className="panel-card system-check-panel">
    <PanelHeader icon={<ClipboardCheck size={22} />} eyebrow={ui.verify.checksEyebrow} title={ui.verify.checksTitle} detail={ui.verify.checksDetail} />
    <div className="system-check-toolbar"><div><strong>{ui.verify.moduleStatus}</strong><span>{ui.verify.checksReadonly}</span></div><OperationButton onClick={onRunAll} operation={operation} icon={<RefreshCw size={15} />} disabled={!canExecute}>{ui.verify.checkAll}</OperationButton></div>
    {catalogStatus === 'loading' && <p className="muted-note">{ui.verify.catalogLoading}</p>}
    {catalogStatus === 'unavailable' && <p className="muted-note">{ui.verify.catalogUnavailable}</p>}
    {catalogStatus === 'ready' && modules.length === 0 && <p className="muted-note">{ui.verify.noModules}</p>}
    {catalogStatus === 'ready' && <div className="system-module-list">{modules.map((module) => {
      const diagnostic = diagnosticByModule.get(module.id)
      const state = !diagnostic ? 'neutral' : diagnostic.status === 'complete' && diagnostic.summary.warnings === 0 ? 'pass' : diagnostic.status === 'unknown' ? 'neutral' : 'warn'
      const checked = diagnostic ? `${diagnostic.summary.passed}/${diagnostic.summary.total} ${ui.verify.componentChecks} · ${diagnostic.summary.warnings} ${ui.verify.warnings} · ${diagnostic.summary.failed} ${ui.verify.errors} · ${formatDate(diagnostic.checked_at, locale)}` : ui.verify.notChecked
      const name = ui.modules.names[module.id]
      return <div className="system-module-row" key={module.id}>
        <span className={`check-status ${state}`}>{state === 'pass' ? <Check size={14} /> : state === 'warn' ? <CircleAlert size={14} /> : <CircleDashed size={14} />}</span>
        <div className="system-module-copy"><strong>{name}</strong><small>{checked}</small>{diagnostic && <span className={`module-detail-state ${diagnostic.status}`}>{ui.states.diagnostic[diagnostic.status]}</span>}
          {diagnostic && <details className="system-module-checks"><summary>{diagnostic.summary.total} {ui.verify.componentChecks} · {diagnostic.summary.failed} {ui.verify.errors} · {diagnostic.summary.warnings} {ui.verify.warnings}</summary><p className="muted-note">{ui.verify.rawDiagnostic}</p><ul>{diagnostic.checks.map((check) => <li className={check.status} key={check.id}><span>{ui.states.check[check.status]}</span><div><strong>{check.title}</strong><small>{check.message}</small></div></li>)}</ul></details>}
        </div>
        <button className="secondary-button system-row-action" onClick={() => onCheckModule(module)} disabled={!canExecute || operation === 'running'} aria-label={`${ui.verify.checkOne}: ${name}`}>{operation === 'running' && activeOperation === 'diagnose-module' ? <LoaderCircle className="spin" size={14} /> : <Activity size={14} />} {ui.verify.checkOne}</button>
      </div>
    })}</div>}
  </div>
}

function ModulesPanel({ modules, catalogStatus, selectedModule, setSelectedModule, selected, selectedDiagnostic, applyBlockReason, onPreview, onApply, onApplyAll, operation, activeOperation, onShowLogs, canExecute, canApply }: { modules: Module[]; catalogStatus: 'loading' | 'ready' | 'unavailable'; selectedModule: string; setSelectedModule: (id: string) => void; selected: Module | null; selectedDiagnostic?: ModuleDiagnostic; applyBlockReason: string; onPreview: () => void; onApply: () => void; onApplyAll: () => void; operation: OperationState; activeOperation: NamedOperation | null; onShowLogs: () => void; canExecute: boolean; canApply: boolean }) {
  const { ui, locale } = useCopy()
  const selectedName = selected ? ui.modules.names[selected.id] : ''
  const dependencies = selected?.dependencies?.map((id) => ui.modules.names[id]) ?? []
  const diagnosticFresh = isDiagnosticFresh(selectedDiagnostic)
  const systemStateLabel = !selectedDiagnostic
    ? ui.apply.systemNotChecked
    : !diagnosticFresh
      ? ui.apply.diagnosticExpired
      : ui.states.diagnostic[selectedDiagnostic.status]
  const readinessLabel = canApply ? ui.apply.readyToApply : ui.apply.notReadyToApply
  return <div className="panel-card modules-panel">
    <PanelHeader icon={<Layers3 size={22} />} eyebrow={ui.apply.eyebrow} title={ui.apply.title} detail={ui.apply.detail} />
    {catalogStatus === 'loading' && <p className="muted-note">{ui.apply.catalogLoading}</p>}
    {catalogStatus === 'unavailable' && <p className="muted-note">{ui.apply.catalogUnavailable}</p>}
    {catalogStatus === 'ready' && modules.length === 0 && <p className="muted-note">{ui.verify.noModules}</p>}
    {catalogStatus === 'ready' && selected && <div className="modules-workspace">
      <nav className="module-list" aria-label={ui.apply.eyebrow}>
        {modules.map((module) => {
          const name = ui.modules.names[module.id]
          return <button className={`module-row ${selectedModule === module.id ? 'selected' : ''}`} key={module.id} onClick={() => setSelectedModule(module.id)} disabled={operation === 'running'} aria-pressed={selectedModule === module.id} aria-label={`${name}, ${ui.states.module[module.state]}`} title={`${name} · ${ui.states.module[module.state]}`}>
            <span className={`module-avatar ${module.accent}`} aria-hidden="true">{moduleIcons[module.id]}</span>
            <span className="module-copy"><strong>{name}</strong></span>
            <span className={`module-state ${module.state.toLowerCase().replace(' ', '-')}`} title={ui.states.module[module.state]}><span className="status-led" /></span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        })}
      </nav>
      <div className="module-detail-pane">
        {operation === 'running' ? <ModuleOperationLoading module={selected} activeOperation={activeOperation} onShowLogs={onShowLogs} /> : <div className="selected-module-block">
          <div className="selected-module">
            <div className="selected-module-copy">
              <div className="selected-module-heading">
                <span className={`module-avatar selected-module-icon ${selected.accent}`} aria-hidden="true">{moduleIcons[selected.id]}</span>
                <div><p className="section-kicker">{ui.apply.selectedModule}</p><h4>{selectedName}</h4></div>
                <span className={`module-detail-state ${selected.state.toLowerCase().replace(' ', '-')}`}>{ui.states.module[selected.state]}</span>
              </div>
              <p className="selected-module-description">{ui.modules.descriptions[selected.id]}</p>
              <div className="module-verification-factors" aria-label={ui.apply.readinessFactorTitle}>
                <section className={`module-verification-factor system-factor ${diagnosticFresh ? `status-${selectedDiagnostic?.status ?? 'unknown'}` : 'status-unchecked'}`}>
                  <p className="section-kicker">{ui.apply.systemFactorTitle}</p>
                  <strong>{systemStateLabel}</strong>
                  <small>{diagnosticFresh ? ui.apply.systemFactorCopy : selectedDiagnostic ? ui.apply.diagnosticExpired : ui.apply.checkFirst}</small>
                  {selectedDiagnostic && diagnosticFresh && <small>{selectedDiagnostic.summary.passed}/{selectedDiagnostic.summary.total} {ui.verify.componentChecks} · {selectedDiagnostic.summary.failed} {ui.verify.errors} · {selectedDiagnostic.summary.warnings} {ui.verify.warnings} · {formatDate(selectedDiagnostic.checked_at, locale)}</small>}
                </section>
                <section className={`module-verification-factor readiness-factor ${canApply ? 'is-ready' : 'is-blocked'}`}>
                  <p className="section-kicker">{ui.apply.readinessFactorTitle}</p>
                  <strong>{readinessLabel}</strong>
                  <small>{canApply ? ui.apply.readinessCriteria : applyBlockReason}</small>
                </section>
              </div>
              {dependencies.length > 0 && <p className="module-dependencies">{ui.apply.dependencies}: {dependencies.join(', ')}.</p>}
            </div>
            <div className="module-actions"><OperationButton onClick={onApply} operation={operation} icon={<Wrench size={15} />} disabled={!canApply}>{ui.apply.applyModule}</OperationButton><OperationButton onClick={onPreview} operation={operation} icon={<Activity size={15} />} disabled={!canExecute}>{ui.apply.previewConfiguration}</OperationButton><OperationButton onClick={onApplyAll} operation={operation} icon={<Layers3 size={15} />} disabled={!canExecute}>{ui.apply.applyAll}</OperationButton></div>
          </div>
        </div>}
      </div>
    </div>}
  </div>
}
function ModuleOperationLoading({ module, activeOperation, onShowLogs }: { module: Module; activeOperation: NamedOperation | null; onShowLogs: () => void }) {
  const { ui } = useCopy()
  const fullApply = activeOperation === 'apply-full' || activeOperation === 'apply-diagnostics'
  const requiresSystemTerminal = fullApply || activeOperation === 'apply-module'
  const moduleName = ui.modules.names[module.id]
  const title = activeOperation === 'diagnose-module' ? ui.apply.checkingModule.replace('{module}', moduleName) : fullApply ? ui.apply.applyingAll : ui.apply.applyingModule.replace('{module}', moduleName)
  return <div className="module-operation-loading"><div className="loading-orbit"><LoaderCircle className="spin" size={24} /></div><div className="loading-copy"><p className="section-kicker">{ui.states.operation.running}</p><h4>{title}</h4><p>{requiresSystemTerminal ? ui.apply.inProgress : ui.apply.showLogs}</p>{requiresSystemTerminal && <div className="manual-attention"><CircleAlert size={16} /><span>{ui.apply.terminalAttention}</span></div>}</div><button className="secondary-button" onClick={onShowLogs}><TerminalSquare size={15} /> {ui.apply.showLogs}</button></div>
}
function StartupScreen({ environment, bridgeChecked, catalogReady }: { environment: DesktopEnvironment | null; bridgeChecked: boolean; catalogReady: boolean }) {
  const { ui } = useCopy()
  const environmentReady = Boolean(environment)
  const checks = [
    { label: ui.welcome.startupDetecting, ready: environmentReady, detail: environment?.name ?? ui.states.operation.running },
    { label: ui.welcome.startupBridge, ready: bridgeChecked, detail: bridgeChecked ? ui.welcome.startupReady : ui.states.operation.running },
    { label: ui.welcome.startupCatalog, ready: catalogReady, detail: catalogReady ? ui.welcome.startupReady : ui.states.operation.running },
  ]
  return <div className="startup-screen"><div className="startup-card"><div className="startup-mark"><img src={logoMark} alt="" aria-hidden="true" /></div><p className="eyebrow accent-text">ALPINE DESKTOP CENTER · ALPHA 42</p><h1>{ui.welcome.startupTitle}</h1><p className="startup-description">{ui.welcome.startupDescription}</p><div className="startup-checks">{checks.map((check) => <div className={`startup-check ${check.ready ? 'ready' : 'pending'}`} key={check.label}><span className="startup-check-dot" /><div><strong>{check.label}</strong><small>{check.detail}</small></div>{check.ready ? <CheckCircle2 size={17} /> : <LoaderCircle className="spin" size={17} />}</div>)}</div>{environment && <div className="startup-capabilities"><span className="section-kicker">{environment.name}</span><div>{environment.capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></div>}</div></div>
}
function ConfigPanel({ apps, onRun, onListApps, onUninstallApp, onCollectGarbage, onUpdateNixApps, onRefreshKdeApps, onMigrateStable, operation, canExecute, stableChannelCheck, canMigrateStable }: { apps: NixApp[]; onRun: () => void; onListApps: () => void; onUninstallApp: (app: NixApp) => void; onCollectGarbage: () => void; onUpdateNixApps: () => void; onRefreshKdeApps: () => void; onMigrateStable: () => void; operation: OperationState; canExecute: boolean; stableChannelCheck: StableChannelCheck | null; canMigrateStable: boolean }) {
  const { ui } = useCopy()
  const reportStatus = stableChannelCheck?.report?.status
  const channelLabel = stableChannelCheck?.status === 'blocked' ? ui.nix.checkBlocked
    : stableChannelCheck?.status === 'error' ? ui.nix.checkFailed
      : reportStatus === 'current' ? ui.nix.upToDate
        : reportStatus === 'update_available' ? ui.nix.updateAvailable
          : stableChannelCheck ? ui.nix.statusUnknown : ui.nix.notChecked
  const channelBadge = stableChannelCheck?.status ?? 'pending'
  const channelOutput = stableChannelCheck?.report
    ? `nixos-${stableChannelCheck.report.current_version ?? ui.chrome.unknown} · ${ui.welcome.latestStable}: nixos-${stableChannelCheck.report.latest_version ?? ui.chrome.unknown}`
    : stableChannelCheck ? ui.nix.reportUnavailable : ui.nix.runCheck
  return <div className="panel-card">
    <PanelHeader icon={<Settings2 size={22} />} eyebrow={ui.nix.eyebrow} title={ui.nix.title} detail={ui.nix.detail} />
    <div className="channel-card"><div className="channel-mark">N</div><div><span className="channel-label">{ui.nix.currentChannel}</span><strong>{channelLabel}</strong><p>{channelOutput}</p></div><span className={`state-badge ${channelBadge}`}>{channelLabel}</span></div>
    <div className="panel-actions"><OperationButton onClick={onRun} operation={operation} icon={<RefreshCw size={15} />} disabled={!canExecute}>{ui.nix.checkChannel}</OperationButton><OperationButton onClick={onMigrateStable} operation={operation} icon={<Wrench size={15} />} disabled={!canExecute || !canMigrateStable}>{ui.nix.migrateStable}</OperationButton></div>
    <div className="muted-note"><LockKeyhole size={13} /> {ui.nix.migrationRequirement}</div>
    <div className="panel-actions"><OperationButton onClick={onUpdateNixApps} operation={operation} icon={<Wrench size={15} />} disabled={!canExecute}>{ui.nix.updateApps}</OperationButton><OperationButton onClick={onRefreshKdeApps} operation={operation} icon={<RefreshCw size={15} />} disabled={!canExecute}>{ui.nix.refreshApps}</OperationButton></div>
    <p className="muted-note">{ui.nix.appActionsDetail}</p>
    <section className="nix-apps-section">
      <div className="section-row nix-apps-heading"><div><p className="section-kicker">{ui.nix.appsTitle}</p><h4>{apps.length ? `${apps.length} ${ui.nix.appsTitle.toLowerCase()}` : ui.nix.appsTitle}</h4></div><OperationButton onClick={onListApps} operation={operation} icon={<RefreshCw size={15} />} disabled={!canExecute}>{ui.nix.listApps}</OperationButton></div>
      {apps.length === 0 ? <p className="muted-note">{ui.nix.noApps}</p> : <div className="nix-app-list">{apps.map((app) => <div className="nix-app-row" key={`${app.index}-${app.name}`}><div><strong>{app.name}</strong>{app.attrPath && <small>{app.attrPath}</small>}<small>#{app.index}{app.active ? '' : ' · inactive'}</small></div><button className="secondary-button" onClick={() => onUninstallApp(app)} disabled={!canExecute || operation === 'running'}>{ui.nix.uninstallApp}</button></div>)}</div>}
      <div className="nix-garbage-row"><p className="muted-note">{ui.nix.garbageDetail}</p><OperationButton onClick={onCollectGarbage} operation={operation} icon={<HardDrive size={15} />} disabled={!canExecute}>{ui.nix.collectGarbage}</OperationButton></div>
    </section>
  </div>
}
function LogsModal({ operation, activeOperation, logs, persistentLogPath, onRefresh, onClose }: { operation: OperationState; activeOperation: NamedOperation | null; logs: LogEntry[]; persistentLogPath: string | null; onRefresh: () => void; onClose: () => void }) {
  const { ui } = useCopy()
  const systemTerminal = activeOperation === 'simulate-full' || activeOperation === 'apply-full' || activeOperation === 'apply-diagnostics' || activeOperation === 'apply-module' || activeOperation === 'refresh-nix-apps' || activeOperation === 'update-nix-apps' || activeOperation === 'uninstall-nix-app' || activeOperation === 'collect-nix-garbage' || activeOperation === 'migrate-stable-channel'
  const statusLabel = operation === 'running' ? ui.logs.running : operation === 'error' ? ui.logs.failed : operation === 'blocked' ? ui.logs.blocked : operation === 'success' ? ui.logs.finished : ui.logs.waiting
  return <div className="logs-modal-backdrop" role="dialog" aria-modal="true" aria-label={ui.logs.ariaLabel}><div className="panel-card logs-modal"><div className="inspector-heading"><div><p className="section-kicker">{ui.logs.eyebrow}</p><h3>{ui.logs.title}</h3></div><button className="icon-button" onClick={onClose} aria-label={ui.logs.close}><XCircle size={17} /></button></div><div className="execution-state"><div className={`big-state-icon ${operation}`}><OperationIcon state={operation} size={24} /></div><div><span className="section-kicker">{ui.logs.currentState}</span><strong>{statusLabel}</strong><p>{ui.logs.namedCommand}: <code>{activeOperation ? ui.history.operationLabels[activeOperation] : '—'}</code></p></div><button className="icon-button subtle" onClick={onRefresh} aria-label={ui.logs.refresh} title={ui.logs.refresh}><RefreshCw size={15} /></button></div>{systemTerminal && <div className="manual-attention"><TerminalSquare size={16} /><span>{ui.logs.systemTerminalWarning}</span></div>}{persistentLogPath && <p className="persistent-log-path"><strong>{ui.logs.savedLog}:</strong> <code>{persistentLogPath}</code></p>}<div className="terminal"><div className="terminal-bar"><span /><span /><span /><small>{ui.logs.terminalTitle}</small></div><div className="terminal-body">{logs.length === 0 && operation !== 'running' && <p className="muted-note">{ui.logs.noOutput}</p>}{logs.map((log, index) => <div className="terminal-line" key={`${log.time}-${index}`}><span className="terminal-time">[{log.time}]</span><span className={`terminal-level ${log.level}`}>{ui.states.logLevel[log.level]}</span><span>{log.text}</span></div>)}{operation === 'running' && <div className="terminal-line live"><LoaderCircle className="spin" size={14} /> {ui.logs.waitingOutput}</div>}</div></div></div></div>
}

function ConfirmationModal({ pending, module, onConfirm, onCancel }: { pending: PendingOperation; module?: Module; onConfirm: () => void; onCancel: () => void }) {
  const { ui } = useCopy()
  const [understood, setUnderstood] = useState(false)
  const fullApply = pending.operation === 'apply-full'
  const preview = pending.operation === 'simulate-full'
  const migrateStable = pending.operation === 'migrate-stable-channel'
  const updateNixApps = pending.operation === 'refresh-nix-apps' || pending.operation === 'update-nix-apps'
  const refreshKdeApps = pending.operation === 'refresh-kde-apps'
  const uninstallNixApp = pending.operation === 'uninstall-nix-app'
  const collectNixGarbage = pending.operation === 'collect-nix-garbage'
  const moduleName = module ? ui.modules.names[module.id] : ui.chrome.unknown
  const title = preview ? ui.confirmation.previewTitle : fullApply ? ui.confirmation.applyAllTitle : migrateStable ? ui.confirmation.migrateTitle : updateNixApps ? ui.confirmation.updateAppsTitle : refreshKdeApps ? ui.confirmation.refreshKdeAppsTitle : uninstallNixApp ? ui.confirmation.uninstallAppTitle(pending.label.split(': ').slice(1).join(': ')) : collectNixGarbage ? ui.confirmation.collectGarbageTitle : ui.confirmation.applyModuleTitle(moduleName)
  const description = preview ? ui.confirmation.previewDescription : fullApply ? ui.confirmation.applyAllDescription : migrateStable ? ui.confirmation.migrateDescription : updateNixApps ? ui.confirmation.updateAppsDescription : refreshKdeApps ? ui.confirmation.refreshKdeAppsDescription : uninstallNixApp ? ui.confirmation.uninstallAppDescription : collectNixGarbage ? ui.confirmation.collectGarbageDescription : ui.confirmation.applyModuleDescription
  const changeLabel = preview ? ui.confirmation.previewChange : refreshKdeApps ? ui.confirmation.desktopRefreshChange : migrateStable || updateNixApps || uninstallNixApp || collectNixGarbage ? ui.confirmation.profileChange : ui.confirmation.systemChange
  const actionLabel = preview ? ui.confirmation.previewAction : migrateStable ? ui.confirmation.migrateAction : updateNixApps ? ui.confirmation.updateAppsAction : refreshKdeApps ? ui.confirmation.refreshKdeAppsAction : uninstallNixApp ? ui.confirmation.uninstallAppAction : collectNixGarbage ? ui.confirmation.collectGarbageAction : ui.confirmation.confirmAction
  const confirmHeading = preview ? ui.confirmation.confirmPreview : refreshKdeApps ? ui.confirmation.confirmRefreshKde : migrateStable || updateNixApps || uninstallNixApp || collectNixGarbage ? ui.confirmation.confirmProfileChange : ui.confirmation.confirmChange
  const reviewMessage = refreshKdeApps ? ui.confirmation.refreshKdeReview : ui.confirmation.reviewAndSnapshot
  const acknowledgement = refreshKdeApps ? ui.confirmation.refreshKdeAcknowledgement : ui.confirmation.acknowledgement
  return <div className="logs-modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="apply-confirm-title">
    <div className="panel-card logs-modal">
      <div className="inspector-heading"><div><p className="section-kicker">{confirmHeading}</p><h3 id="apply-confirm-title">{title}</h3></div><button className="icon-button" onClick={onCancel} aria-label={ui.confirmation.cancel}><XCircle size={17} /></button></div>
      <div className="validation-banner invalid"><CircleAlert size={20} /><div><strong>{changeLabel}</strong><p>{description}</p><p>{reviewMessage}</p></div></div>
      <label className="confirm-acknowledgement"><input type="checkbox" checked={understood} onChange={(event) => setUnderstood(event.target.checked)} /> {acknowledgement}</label>
      <div className="panel-actions"><button className="secondary-button" onClick={onCancel}>{ui.confirmation.cancel}</button><button className="primary-button" onClick={onConfirm} disabled={!understood}>{preview ? <Activity size={15} /> : refreshKdeApps ? <RefreshCw size={15} /> : <Wrench size={15} />}{actionLabel}</button></div>
    </div>
  </div>
}

function SummaryPanel({ operation, records, history, historyRefreshing, onRefreshHistory, onOpenLog, onGoVerify, onGoApply }: { operation: OperationState; records: OperationRecord[]; history: OperationLogSummary[]; historyRefreshing: boolean; onRefreshHistory: () => void; onOpenLog: (entry: OperationLogSummary) => void; onGoVerify: () => void; onGoApply: () => void }) {
  const { ui, locale } = useCopy()
  const applied = records.filter((record) => record.status === 'success' && record.operation.startsWith('apply-')).length
  const failedOrBlocked = records.filter((record) => record.status === 'error' || record.status === 'blocked').length
  const headline = operation === 'success' ? ui.history.latestComplete : operation === 'error' ? ui.history.latestFailed : operation === 'blocked' ? ui.history.latestBlocked : ui.history.reportTitle
  return <div className="panel-card execution-report-panel"><div className="execution-report-heading"><div><p className="section-kicker">{ui.history.eyebrow}</p><h3>{headline}</h3><p>{ui.history.description}</p></div><button className="icon-button subtle" onClick={onRefreshHistory} disabled={historyRefreshing} aria-label={ui.history.refresh} title={ui.history.refreshTitle}>{historyRefreshing ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}</button></div>
    <div className="summary-stats"><Metric label={ui.history.successfulApplies} value={`${applied}`} /><Metric label={ui.history.failedBlocked} value={`${failedOrBlocked}`} /><Metric label={ui.history.sessionRecords} value={`${records.length}`} /><Metric label={ui.history.savedLogs} value={`${history.length}`} /></div>
    <div className="summary-actions"><button className="secondary-button" onClick={onGoVerify}><ClipboardCheck size={15} /> {ui.history.verifySystem}</button><button className="secondary-button" onClick={onGoApply}><Layers3 size={15} /> {ui.history.applyModules}</button></div>
    <section className="report-history"><div className="report-history-heading"><h4>{ui.history.savedOperationLogs}</h4><span>{ui.history.privateRelease}</span></div>{history.length === 0 ? <p className="muted-note">{ui.history.noLogs} {ui.history.logsCreatedBy}</p> : <div className="report-history-list">{history.slice(0, 20).map((entry) => <div className="report-history-row" key={entry.id}><span className={`history-state ${entry.status}`}>{ui.states.history[entry.status]}</span><div><strong>{entry.module ? `${ui.history.operationLabels[entry.operation]} · ${ui.modules.names[entry.module]}` : ui.history.operationLabels[entry.operation]}</strong><small>{entry.module ? `${ui.modules.names[entry.module]} · ` : ''}{formatDate(entry.started_at ?? entry.modified * 1000, locale)} · {entry.path}</small></div><button className="audit-link compact" onClick={() => onOpenLog(entry)}><FileClock size={14} /> {ui.history.openLog}</button></div>)}</div>}</section>
    {records.length > 0 && <section className="session-record-history"><h4>{ui.history.currentSession}</h4>{records.slice(-8).reverse().map((record, index) => <div key={`${record.time}-${index}`}><span className={`history-state ${record.status}`}>{ui.states.history[record.status]}</span><strong>{record.label}</strong><small>{record.time}</small></div>)}</section>}
  </div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>
}

function SavedLogModal({ entry, loading, error, onClose }: { entry: SavedOperationLog; loading: boolean; error: string; onClose: () => void }) {
  const { ui, locale } = useCopy()
  const moduleName = entry.module ? `${ui.modules.names[entry.module]} · ` : ''
  return <div className="logs-modal-backdrop" role="dialog" aria-modal="true" aria-label={ui.savedLog.ariaLabel}><div className="panel-card logs-modal saved-log-modal"><div className="inspector-heading"><div><p className="section-kicker">{ui.savedLog.eyebrow}</p><h3>{ui.history.operationLabels[entry.operation]}</h3></div><button className="icon-button" onClick={onClose} aria-label={ui.savedLog.close}><XCircle size={17} /></button></div><div className="saved-log-meta"><span className={`history-state ${entry.status}`}>{ui.states.history[entry.status]}</span><span>{moduleName}{formatDate(entry.started_at ?? entry.modified * 1000, locale)}</span></div><p className="persistent-log-path"><strong>{ui.savedLog.savedLog}:</strong> <code>{entry.path}</code></p><div className="terminal"><div className="terminal-bar"><span /><span /><span /><small>{entry.id}.log · {ui.savedLog.savedHistory}</small></div>{error && <details><summary>{ui.inspector.backendDetails}</summary><p>{error}</p></details>}<pre className="saved-log-body">{loading ? ui.savedLog.loading : error ? ui.savedLog.readError : entry.content || ui.savedLog.empty}</pre></div></div></div>
}

export default App
