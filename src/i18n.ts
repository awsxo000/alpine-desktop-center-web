import type { DiagnosticCheckStatus, DiagnosticStatus, LogEntry, ModuleId, ModuleState, NamedOperation, OperationLogStatus, OperationState, StepId } from './types'

export type Locale = 'pt-BR' | 'en-US'
type PageId = Exclude<StepId, 'welcome'>

type UiCopy = {
  language: string
  languagePt: string
  languageEn: string
  languagePtFull: string
  languageEnFull: string
  documentTitle: string
  nav: Record<StepId, { label: string; note: string }>
  pages: Record<PageId, { heading: string; lede: string }>
  chrome: {
    workspaceSections: string
    alpineWorkspace: string
    frontend: string
    backend: string
    toggleTheme: string
    unknown: string
    localBridgeValidated: string
    bridgeBlocked: string
    bridgeOffline: string
  }
  welcome: {
    systemWorkspace: string
    heroTitle: string
    heroTitleAccent: string
    heroDescription: string
    purposeLabel: string
    purposeBaseTitle: string
    purposeBaseDescription: string
    purposeModulesTitle: string
    purposeModulesDescription: string
    scopeNote: string
    inspectRelease: string
    browseModules: string
    currentSnapshot: string
    systemSignals: string
    openSystemCheck: string
    backendIntegrity: string
    validated: string
    blocked: string
    unavailable: string
    stableChannel: string
    stableUpToDate: string
    stableUpdateAvailable: string
    stableCheckFailed: string
    stableBlocked: string
    stableUnknown: string
    stableNotChecked: string
    lastVerification: string
    latestStable: string
    noStableCheck: string
    openNix: string
  }
  verify: {
    validationEyebrow: string
    validationTitle: string
    validationDetail: string
    backendDetected: string
    validationUnavailable: string
    pass: string
    blocked: string
    backendVersion: string
    frontendVersion: string
    releaseLocation: string
    lastValidation: string
    currentSession: string
    notValidated: string
    validateAgain: string
    checksEyebrow: string
    checksTitle: string
    checksDetail: string
    moduleStatus: string
    checksReadonly: string
    checkAll: string
    checkOne: string
    notChecked: string
    lastApply: string
    noSavedApply: string
    componentChecks: string
    errors: string
    warnings: string
    openHistory: string
    catalogLoading: string
    catalogUnavailable: string
    noModules: string
    rawDiagnostic: string
  }
  apply: {
    eyebrow: string
    title: string
    detail: string
    selectedModule: string
    systemFactorTitle: string
    systemFactorCopy: string
    systemNotChecked: string
    diagnosticExpired: string
    readinessFactorTitle: string
    readyToApply: string
    notReadyToApply: string
    readinessCriteria: string
    dependencies: string
    applyModule: string
    applyAll: string
    previewConfiguration: string
    helpTitle: string
    helpDescription: string
    checkingModule: string
    applyingModule: string
    applyingAll: string
    inProgress: string
    showLogs: string
    terminalAttention: string
    blockBackend: string
    catalogLoading: string
    catalogUnavailable: string
    checkFirst: string
    unknownDiagnostic: string
    catalogMismatch: string
    dependencyBlockers: (names: string) => string
  }
  nix: {
    eyebrow: string
    title: string
    detail: string
    currentChannel: string
    checkBlocked: string
    checkFailed: string
    upToDate: string
    updateAvailable: string
    statusUnknown: string
    notChecked: string
    reportUnavailable: string
    runCheck: string
    stableOnly: string
    stablePolicy: string
    checkChannel: string
    refreshApps: string
    updateApps: string
    appActionsDetail: string
    migrateStable: string
    migrationRequirement: string
    noSwitch: string
    openLog: string
  }
  history: {
    operationLabels: Record<NamedOperation, string>
    eyebrow: string
    title: string
    latestComplete: string
    latestFailed: string
    latestBlocked: string
    reportTitle: string
    description: string
    successfulApplies: string
    failedBlocked: string
    sessionRecords: string
    savedLogs: string
    refresh: string
    refreshTitle: string
    savedOperationLogs: string
    privateRelease: string
    noLogs: string
    logsCreatedBy: string
    openLog: string
    currentSession: string
    overview: string
    applyModules: string
    verifySystem: string
  }
  inspector: {
    operationStatus: string
    protectedExecution: string
    ready: string
    noOperation: string
    operationInProgress: string
    operationBlocked: string
    operationFailed: string
    operationComplete: string
    backendDetails: string
    sessionAudit: string
    activityStream: string
    recentEvents: string
    refreshCurrent: string
    showLogs: string
    noActivity: string
    outputOriginal: string
  }
  confirmation: {
    previewTitle: string
    applyAllTitle: string
    migrateTitle: string
    updateAppsTitle: string
    refreshKdeAppsTitle: string
    applyModuleTitle: (name: string) => string
    previewDescription: string
    applyAllDescription: string
    migrateDescription: string
    updateAppsDescription: string
    refreshKdeAppsDescription: string
    applyModuleDescription: string
    previewChange: string
    profileChange: string
    desktopRefreshChange: string
    systemChange: string
    previewAction: string
    migrateAction: string
    updateAppsAction: string
    refreshKdeAppsAction: string
    confirmAction: string
    confirmPreview: string
    confirmChange: string
    confirmProfileChange: string
    confirmRefreshKde: string
    reviewAndSnapshot: string
    refreshKdeReview: string
    acknowledgement: string
    refreshKdeAcknowledgement: string
    cancel: string
  }
  logs: {
    ariaLabel: string
    eyebrow: string
    title: string
    close: string
    currentState: string
    running: string
    failed: string
    blocked: string
    finished: string
    waiting: string
    namedCommand: string
    systemTerminalWarning: string
    savedLog: string
    terminalTitle: string
    waitingOutput: string
    refresh: string
    show: string
    noOutput: string
  }
  savedLog: {
    ariaLabel: string
    eyebrow: string
    close: string
    savedLog: string
    savedHistory: string
    loading: string
    empty: string
    readError: string
  }
  states: {
    operation: Record<OperationState, string>
    history: Record<OperationLogStatus, string>
    module: Record<ModuleState, string>
    diagnostic: Record<DiagnosticStatus, string>
    check: Record<DiagnosticCheckStatus, string>
    logLevel: Record<LogEntry['level'], string>
  }
  modules: {
    names: Record<ModuleId, string>
    descriptions: Record<ModuleId, string>
  }
  messages: {
    checkingBridge: string
    unsupportedSchema: (schema: string) => string
    bridgeUnavailable: string
    catalogUnavailable: string
    historyRefreshFailed: (detail: string) => string
    savedLogReadFailed: (detail: string) => string
    blockedBackend: string
    blockedLabel: (label: string) => string
    startingOperation: (label: string) => string
    openingChannel: string
    operationBlocked: (detail: string) => string
    httpError: (status: number) => string
    missingSession: string
    deadline: string
    operationFailed: (label: string, detail: string) => string
    operationComplete: (label: string, detail: string) => string
    migrationNotAllowed: string
    outputRefreshFailed: (detail: string) => string
    validationRecheckFailed: (detail: string) => string
  }
}

const en: UiCopy = {
  language: 'Language',
  languagePt: 'BR',
  languageEn: 'US',
  languagePtFull: 'Brazilian Portuguese',
  languageEnFull: 'English (United States)',
  documentTitle: 'Alpine Desktop Center',
  nav: {
    welcome: { label: 'Home', note: 'Overview' },
    verify: { label: 'Verify', note: 'Backend and diagnostics' },
    apply: { label: 'Apply', note: 'Desktop modules' },
    nix: { label: 'Nix', note: 'Stable channel and apps' },
    history: { label: 'History', note: 'Operations and logs' },
  },
  pages: {
    verify: { heading: 'Verify before changing.', lede: 'Check backend integrity and run read-only diagnostics here. Verification does not apply configuration.' },
    apply: { heading: 'Choose what to configure.', lede: 'Select a desktop module. Apply is enabled only after a fresh diagnostic and complete dependencies.' },
    nix: { heading: 'Nix channel and applications.', lede: 'Check the official channel, update user-profile apps, or migrate only after an official update is confirmed.' },
    history: { heading: 'Review what happened.', lede: 'Session totals and persistent local operation logs are collected in one place.' },
  },
  chrome: {
    workspaceSections: 'MAIN SECTIONS',
    alpineWorkspace: 'ALPINE WORKSPACE',
    frontend: 'FRONTEND',
    backend: 'BACKEND',
    toggleTheme: 'Toggle theme',
    unknown: 'Unknown',
    localBridgeValidated: 'Local bridge validated',
    bridgeBlocked: 'Bridge reachable · integrity/schema blocked',
    bridgeOffline: 'Local bridge offline',
  },
  welcome: {
    systemWorkspace: 'SYSTEM WORKSPACE',
    heroTitle: 'An Alpine desktop.',
    heroTitleAccent: 'Configured with care.',
    heroDescription: 'Alpine Desktop Center configures an existing Alpine Linux desktop, bringing Nix applications and desktop modules together with visible checks before changes.',
    purposeLabel: 'TWO CLEAR STEPS',
    purposeBaseTitle: 'Verify',
    purposeBaseDescription: 'Confirm backend integrity and inspect current system state.',
    purposeModulesTitle: 'Apply',
    purposeModulesDescription: 'Choose a module, review its changes, confirm, and track the output.',
    scopeNote: 'Configures an existing Alpine install; it does not install the operating system.',
    inspectRelease: 'Verify system',
    browseModules: 'Apply modules',
    currentSnapshot: 'CURRENT SNAPSHOT',
    systemSignals: 'System status',
    openSystemCheck: 'Open verification',
    backendIntegrity: 'Backend integrity',
    validated: 'Validated',
    blocked: 'Blocked',
    unavailable: 'Unavailable',
    stableChannel: 'Stable channel',
    stableUpToDate: 'Up to date',
    stableUpdateAvailable: 'Update available',
    stableCheckFailed: 'Check failed',
    stableBlocked: 'Blocked',
    stableUnknown: 'Status unknown',
    stableNotChecked: 'Not checked',
    lastVerification: 'Last verification',
    latestStable: 'Latest Stable',
    noStableCheck: 'No saved Stable channel check yet.',
    openNix: 'Open Nix',
  },
  verify: {
    validationEyebrow: 'BACKEND VALIDATION',
    validationTitle: 'Backend release integrity.',
    validationDetail: 'The embedded backend and SHA-256 manifest are checked before each privileged action.',
    backendDetected: 'Backend detected and validated',
    validationUnavailable: 'Backend validation unavailable',
    pass: 'PASS',
    blocked: 'BLOCKED',
    backendVersion: 'Backend version',
    frontendVersion: 'Frontend version',
    releaseLocation: 'Release location',
    lastValidation: 'Last validation',
    currentSession: 'Current session',
    notValidated: 'Not validated',
    validateAgain: 'Validate again',
    checksEyebrow: 'READ-ONLY INSPECTION',
    checksTitle: 'System diagnostics',
    checksDetail: 'Module diagnostics report what is currently installed/configured. Apply separately checks embedded backend-file integrity, fresh dependency diagnostics and installation readiness; missing module components can be expected before setup.',
    moduleStatus: 'Module status',
    checksReadonly: 'Checks do not apply configuration.',
    checkAll: 'Check all modules',
    checkOne: 'Check',
    notChecked: 'Not checked in this session.',
    lastApply: 'Last apply',
    noSavedApply: 'No saved apply for this module in this release history.',
    componentChecks: 'component checks',
    errors: 'errors',
    warnings: 'warnings',
    openHistory: 'Open history',
    catalogLoading: 'Loading the live module catalog…',
    catalogUnavailable: 'The live module catalog is unavailable. Verify the backend before continuing.',
    noModules: 'No modules are available.',
    rawDiagnostic: 'Original diagnostic output',
  },
  apply: {
    eyebrow: 'DESKTOP MODULES',
    title: 'Apply a selected module.',
    detail: 'Review the current system state and installation readiness separately. Apply requires fresh diagnostics, complete dependencies and valid embedded backend files.',
    selectedModule: 'Selected module',
    systemFactorTitle: '1 · Current system state',
    systemFactorCopy: 'Read-only checks report installed packages, services and configuration for this module.',
    systemNotChecked: 'Not checked yet',
    diagnosticExpired: 'Check expired · run it again',
    readinessFactorTitle: '2 · Installation readiness',
    readyToApply: 'Ready to apply',
    notReadyToApply: 'Not ready yet',
    readinessCriteria: 'Backend integrity passed · fresh module check · declared dependencies complete.',
    dependencies: 'Dependencies',
    applyModule: 'Apply module',
    applyAll: 'Apply all modules',
    previewConfiguration: 'Preview configuration',
    helpTitle: 'Before you apply',
    helpDescription: 'Run a fresh check first. Changes open in the system terminal; this alpha does not provide automatic undo.',
    checkingModule: 'Checking {module}',
    applyingModule: 'Applying {module}',
    applyingAll: 'Applying all modules',
    inProgress: 'Output appears in View logs while the system terminal runs. Check whether the terminal is behind this window; do not retry the operation.',
    showLogs: 'View logs',
    terminalAttention: 'Authentication happens outside the browser. If doas asks for a password, enter it only in the separate system terminal.',
    blockBackend: 'Backend integrity or diagnostic schema is not validated.',
    catalogLoading: 'Loading the module catalog…',
    catalogUnavailable: 'The live module catalog is unavailable.',
    checkFirst: 'Run a fresh check for this module in Verify before applying it. Checks expire after 10 minutes.',
    unknownDiagnostic: 'The module diagnostic returned an unknown status. Run it again before applying.',
    catalogMismatch: 'The module diagnostic dependencies do not match the live catalog. Refresh the diagnostic before applying.',
    dependencyBlockers: (names) => `Check these dependencies first and require complete status: ${names}.`,
  },
  nix: {
    eyebrow: 'NIX CHANNEL AND APPS',
    title: 'Official Stable only.',
    detail: 'Alpine Desktop Center does not offer a rolling or Unstable channel. Channel updates and Nix apps stay on the official Stable path.',
    currentChannel: 'CURRENT CHANNEL',
    checkBlocked: 'Check blocked',
    checkFailed: 'Check failed',
    upToDate: 'Up to date',
    updateAvailable: 'Update available',
    statusUnknown: 'Status unknown',
    notChecked: 'Not checked',
    reportUnavailable: 'The official Stable status endpoint did not return a recognized response.',
    runCheck: 'Check the installed official Stable channel.',
    stableOnly: 'Official Stable only',
    stablePolicy: 'This app does not offer or apply a switch to rolling or Unstable packages.',
    checkChannel: 'Check Stable channel',
    refreshApps: 'Refresh Nix apps',
    updateApps: 'Update Nix apps',
    appActionsDetail: 'Update changes packages in the user Nix profile; refresh rebuilds the KDE app menu and restarts Plasma without upgrading packages.',
    migrateStable: 'Migrate to latest Stable',
    migrationRequirement: 'Migration requires a successful official check from the last 10 minutes that reports an update.',
    noSwitch: 'No switch to rolling or Unstable packages is offered or performed by this application.',
    openLog: 'Open log',
  },
  history: {
    operationLabels: { 'validate-backend': 'Validate backend', 'check-all-modules': 'Check all modules', 'system-check': 'System check', 'diagnose-module': 'Check module', 'apply-module': 'Apply module', 'apply-full': 'Apply all modules', 'apply-diagnostics': 'Apply diagnostics', 'simulate-full': 'Preview configuration', 'check-stable-channel': 'Check Stable channel', 'refresh-nix-apps': 'Update Nix applications', 'update-nix-apps': 'Update Nix applications', 'refresh-kde-apps': 'Refresh Nix apps in KDE', 'migrate-stable-channel': 'Migrate Stable channel' },
    eyebrow: 'SESSION AND PERSISTENT LOGS',
    title: 'Operation history',
    latestComplete: 'Latest operation completed.',
    latestFailed: 'Latest operation failed.',
    latestBlocked: 'Latest operation was blocked.',
    reportTitle: 'Session summary',
    description: 'Session counts and saved operation logs for this release.',
    successfulApplies: 'Successful applies this session',
    failedBlocked: 'Failed or blocked operations',
    sessionRecords: 'Session records',
    savedLogs: 'Saved operation logs',
    refresh: 'Refresh history',
    refreshTitle: 'Refresh saved operation history',
    savedOperationLogs: 'Saved operation logs',
    privateRelease: 'Private to this local release',
    noLogs: 'No operation logs are stored in this release yet.',
    logsCreatedBy: 'A verification or apply will create its own saved log.',
    openLog: 'Open log',
    currentSession: 'Current browser session',
    overview: 'Overview',
    applyModules: 'Apply modules',
    verifySystem: 'Verify system',
  },
  inspector: {
    operationStatus: 'OPERATION STATUS',
    protectedExecution: 'Protected execution',
    ready: 'Ready',
    noOperation: 'No operation running',
    operationInProgress: 'Operation in progress',
    operationBlocked: 'Operation blocked',
    operationFailed: 'Operation failed',
    operationComplete: 'Operation complete',
    backendDetails: 'Technical details',
    sessionAudit: 'SESSION AUDIT',
    activityStream: 'Activity stream',
    recentEvents: 'Recent session events',
    refreshCurrent: 'Refresh current operation',
    showLogs: 'Show logs',
    noActivity: 'No activity yet.',
    outputOriginal: 'Original output',
  },
  confirmation: {
    previewTitle: 'Run a full configuration preview?',
    applyAllTitle: 'Apply all modules?',
    migrateTitle: 'Migrate to the latest official Stable Nix channel?',
    updateAppsTitle: 'Update Nix applications in the user profile?',
    refreshKdeAppsTitle: 'Refresh Nix apps in KDE?',
    applyModuleTitle: (name) => `Apply ${name}?`,
    previewDescription: 'This runs Ansible in check mode with diff only when make, Ansible and prepared release-local state already exist; it does not install prerequisites. Check mode is best-effort: command and shell tasks without check-mode support may be skipped.',
    applyAllDescription: 'The current backend defaults can install packages, enable or reconfigure services, create a 12 GiB swapfile and update boot parameters for hibernation when supported.',
    migrateDescription: 'The operation updates the configured Nix channel and runs nix-channel --update. It is enabled only after the official Stable check reports a newer release.',
    updateAppsDescription: 'The operation updates applications in the current user Nix profile. Review the terminal output and verify the profile afterwards.',
    refreshKdeAppsDescription: 'This rebuilds the KDE app menu cache and restarts Plasma after a short delay. It does not upgrade packages, change the Nix profile, or reboot the system.',
    applyModuleDescription: 'This role can install or update packages and change system services or configuration files.',
    previewChange: 'Preview check mode; still best-effort.',
    profileChange: 'This action changes the user Nix profile or channel.',
    desktopRefreshChange: 'The Plasma shell restarts in your current desktop session; its panel may briefly disappear.',
    systemChange: 'This action changes the installed system.',
    previewAction: 'Run preview',
    migrateAction: 'Migrate Stable',
    updateAppsAction: 'Update Nix apps',
    refreshKdeAppsAction: 'Refresh KDE menu',
    confirmAction: 'Confirm and run',
    confirmPreview: 'CONFIRM BEST-EFFORT PREVIEW',
    confirmChange: 'CONFIRM SYSTEM CHANGE',
    confirmProfileChange: 'CONFIRM NIX PROFILE CHANGE',
    confirmRefreshKde: 'CONFIRM DESKTOP REFRESH',
    reviewAndSnapshot: 'Review terminal output before proceeding; use a disposable VM snapshot for early testing.',
    refreshKdeReview: 'The KDE app menu and panel may briefly reload while Plasma restarts.',
    acknowledgement: 'I understand this operation can modify the system, Nix profile, or release-local state.',
    refreshKdeAcknowledgement: 'I understand this rebuilds the KDE app menu and restarts Plasma without upgrading Nix packages.',
    cancel: 'Cancel',
  },
  logs: {
    ariaLabel: 'Operation logs',
    eyebrow: 'OPERATION LOGS',
    title: 'Backend output',
    close: 'Close logs',
    currentState: 'CURRENT STATE',
    running: 'Running operation',
    failed: 'Operation failed',
    blocked: 'Operation blocked',
    finished: 'Operation finished',
    waiting: 'Waiting for an operation',
    namedCommand: 'Named command',
    systemTerminalWarning: 'This operation runs in a separate system terminal. If authentication is requested, enter credentials only there. Do not enter credentials in the browser.',
    savedLog: 'Saved log',
    terminalTitle: 'activity.log · current session',
    waitingOutput: 'Waiting for local operation output…',
    refresh: 'Refresh current operation',
    show: 'Show logs',
    noOutput: 'No output has been recorded yet.',
  },
  savedLog: {
    ariaLabel: 'Saved operation log',
    eyebrow: 'PERSISTENT OPERATION LOG',
    close: 'Close saved log',
    savedLog: 'Saved log',
    savedHistory: 'saved history',
    loading: 'Loading saved log…',
    empty: '(The saved log is empty.)',
    readError: 'Could not read the saved operation log.',
  },
  states: {
    operation: { idle: 'Ready', running: 'Running', waiting: 'Waiting', success: 'Complete', error: 'Failed', blocked: 'Blocked' },
    history: { success: 'Complete', error: 'Failed', blocked: 'Blocked', running: 'Running', unknown: 'Unknown' },
    module: { Ready: 'Ready', 'Needs attention': 'Needs attention', 'Not detected': 'Not detected', Unknown: 'Unknown' },
    diagnostic: { complete: 'Complete', partial: 'Partial', incomplete: 'Incomplete', unknown: 'Unknown' },
    check: { ok: 'PASS', warning: 'WARN', error: 'MISSING', unknown: 'UNKNOWN' },
    logLevel: { info: 'INFO', success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' },
  },
  modules: {
    names: { base: 'Base', audio: 'Audio', energia: 'Energy', fontes: 'Fonts', kde: 'KDE Plasma', bluetooth: 'Bluetooth', rede: 'Network', nix: 'Nix', nix_opengl: 'Nix OpenGL', steam: 'Steam', swap: 'Swap' },
    descriptions: {
      base: 'Core Alpine desktop packages and privileges.', audio: 'PipeWire, WirePlumber and session audio.', energia: 'Desktop power and hibernation settings.', fontes: 'Fonts and desktop font configuration.', kde: 'KDE Plasma desktop and OpenRC compatibility.', bluetooth: 'Bluetooth services and device support.', rede: 'NetworkManager and managed network devices.', nix: 'Nix package manager and user profile integration.', nix_opengl: 'OpenGL support for applications installed with Nix.', steam: 'Gaming stack and Steam applications through Nix.', swap: 'Swap space and hibernation support.',
    },
  },
  messages: {
    checkingBridge: 'Checking the local browser bridge…',
    unsupportedSchema: (schema) => `Unsupported diagnostic schema: ${schema}. Operations are blocked.`,
    bridgeUnavailable: 'The local backend bridge is not connected.',
    catalogUnavailable: 'Could not load the module catalog.',
    historyRefreshFailed: (detail) => `Could not refresh saved operation history: ${detail}`,
    savedLogReadFailed: (detail) => `Could not read the saved operation log: ${detail}`,
    blockedBackend: 'Operations are blocked until the local bridge reports a validated backend.',
    blockedLabel: (label) => `${label} was blocked because backend integrity is not validated.`,
    startingOperation: (label) => `Starting named operation: ${label}`,
    openingChannel: 'Opening the protected local operation channel…',
    operationBlocked: (detail) => `Operation blocked: ${detail}`,
    httpError: (status) => `Local bridge returned HTTP ${status}`,
    missingSession: 'The local bridge did not return an operation session.',
    deadline: 'The operation exceeded the UI safety deadline. Check the system terminal and operation log before retrying.',
    operationFailed: (label, detail) => `${label} failed: ${detail}`,
    operationComplete: (label, detail) => `${label}: ${detail}`,
    migrationNotAllowed: 'Run a successful, recent official Stable check first; migration is allowed only while it reports an update.',
    outputRefreshFailed: (detail) => `Could not refresh operation output: ${detail}`,
    validationRecheckFailed: (detail) => `Health revalidation failed: ${detail}`,
  },
}

const pt: UiCopy = {
  language: 'Idioma',
  languagePt: 'BR',
  languageEn: 'US',
  languagePtFull: 'Português brasileiro',
  languageEnFull: 'Inglês dos Estados Unidos',
  documentTitle: 'Alpine Desktop Center',
  nav: {
    welcome: { label: 'Início', note: 'Visão geral' },
    verify: { label: 'Verificar', note: 'Integridade e diagnósticos' },
    apply: { label: 'Aplicar', note: 'Módulos do desktop' },
    nix: { label: 'Nix', note: 'Canal Stable e aplicativos' },
    history: { label: 'Histórico', note: 'Operações e registros' },
  },
  pages: {
    verify: { heading: 'Verifique antes de alterar.', lede: 'Confira a integridade do backend e execute diagnósticos somente para leitura. Verificar não aplica configurações.' },
    apply: { heading: 'Escolha o que configurar.', lede: 'Selecione um módulo de desktop. Aplicar só é liberado após um diagnóstico recente e dependências completas.' },
    nix: { heading: 'Canal Nix e aplicativos.', lede: 'Verifique o canal oficial, atualize aplicativos do perfil do usuário ou migre após confirmar uma atualização.' },
    history: { heading: 'Revise o que aconteceu.', lede: 'Contagens da sessão e registros locais persistentes ficam reunidos em um só lugar.' },
  },
  chrome: {
    workspaceSections: 'SEÇÕES PRINCIPAIS',
    alpineWorkspace: 'AMBIENTE ALPINE',
    frontend: 'INTERFACE',
    backend: 'BACKEND',
    toggleTheme: 'Alternar tema',
    unknown: 'Desconhecido',
    localBridgeValidated: 'Ponte local validada',
    bridgeBlocked: 'Ponte acessível · integridade/esquema bloqueados',
    bridgeOffline: 'Ponte local desconectada',
  },
  welcome: {
    systemWorkspace: 'AMBIENTE DO SISTEMA',
    heroTitle: 'Um desktop Alpine.',
    heroTitleAccent: 'Configurado com cuidado.',
    heroDescription: 'O Alpine Desktop Center configura um desktop Alpine Linux já instalado, reunindo aplicativos Nix e módulos de desktop com verificações visíveis antes das alterações.',
    purposeLabel: 'DOIS PASSOS CLAROS',
    purposeBaseTitle: 'Verificar',
    purposeBaseDescription: 'Confirme a integridade do backend e inspecione o estado atual do sistema.',
    purposeModulesTitle: 'Aplicar',
    purposeModulesDescription: 'Escolha um módulo, revise as alterações, confirme e acompanhe a saída.',
    scopeNote: 'Configura um Alpine já instalado; não instala o sistema operacional.',
    inspectRelease: 'Verificar o sistema',
    browseModules: 'Aplicar módulos',
    currentSnapshot: 'VISÃO ATUAL',
    systemSignals: 'Estado do sistema',
    openSystemCheck: 'Abrir verificação',
    backendIntegrity: 'Integridade do backend',
    validated: 'Validado',
    blocked: 'Bloqueado',
    unavailable: 'Indisponível',
    stableChannel: 'Canal Stable',
    stableUpToDate: 'Atualizado',
    stableUpdateAvailable: 'Atualização disponível',
    stableCheckFailed: 'Verificação falhou',
    stableBlocked: 'Bloqueado',
    stableUnknown: 'Status desconhecido',
    stableNotChecked: 'Não verificado',
    lastVerification: 'Última verificação',
    latestStable: 'Última versão Stable',
    noStableCheck: 'Ainda não há verificação Stable salva.',
    openNix: 'Abrir Nix',
  },
  verify: {
    validationEyebrow: 'VALIDAÇÃO DO BACKEND',
    validationTitle: 'Integridade do backend da versão.',
    validationDetail: 'O backend integrado e o manifesto SHA-256 são verificados antes de cada ação privilegiada.',
    backendDetected: 'Backend detectado e validado',
    validationUnavailable: 'Não foi possível validar o backend',
    pass: 'APROVADO',
    blocked: 'BLOQUEADO',
    backendVersion: 'Versão do backend',
    frontendVersion: 'Versão da interface',
    releaseLocation: 'Local da versão',
    lastValidation: 'Última validação',
    currentSession: 'Sessão atual',
    notValidated: 'Não validado',
    validateAgain: 'Validar novamente',
    checksEyebrow: 'INSPEÇÃO SOMENTE PARA LEITURA',
    checksTitle: 'Diagnósticos do sistema',
    checksDetail: 'Os diagnósticos mostram o que está instalado/configurado no sistema. Em Aplicar, a prontidão é avaliada separadamente: integridade SHA-256 dos arquivos do backend embarcado, diagnósticos recentes das dependências e condições para instalar. Componentes ausentes no próprio módulo podem ser esperados antes da configuração.',
    moduleStatus: 'Estado dos módulos',
    checksReadonly: 'As verificações não aplicam alterações à configuração.',
    checkAll: 'Verificar todos os módulos',
    checkOne: 'Verificar',
    notChecked: 'Ainda não verificado nesta sessão.',
    lastApply: 'Última aplicação',
    noSavedApply: 'Não há aplicação salva deste módulo no histórico desta versão.',
    componentChecks: 'verificações de componentes',
    errors: 'erros',
    warnings: 'avisos',
    openHistory: 'Abrir histórico',
    catalogLoading: 'Carregando catálogo de módulos…',
    catalogUnavailable: 'O catálogo ao vivo de módulos está indisponível. Valide o backend antes de continuar.',
    noModules: 'Nenhum módulo está disponível.',
    rawDiagnostic: 'Saída original do diagnóstico',
  },
  apply: {
    eyebrow: 'MÓDULOS DO DESKTOP',
    title: 'Aplique um módulo selecionado.',
    detail: 'Confira separadamente o estado atual do sistema e a prontidão para instalar. Aplicar exige diagnósticos recentes, dependências completas e integridade dos arquivos do backend embarcado.',
    selectedModule: 'Módulo selecionado',
    systemFactorTitle: '1 · Estado atual do sistema',
    systemFactorCopy: 'Verificações somente para leitura mostram pacotes, serviços e configurações já presentes para este módulo.',
    systemNotChecked: 'Ainda não verificado',
    diagnosticExpired: 'Verificação expirada · execute novamente',
    readinessFactorTitle: '2 · Prontidão para instalar',
    readyToApply: 'Pronto para aplicar',
    notReadyToApply: 'Ainda não está pronto',
    readinessCriteria: 'Integridade do backend aprovada · diagnóstico recente do módulo · dependências declaradas completas.',
    dependencies: 'Dependências',
    applyModule: 'Aplicar módulo',
    applyAll: 'Aplicar todos os módulos',
    previewConfiguration: 'Pré-visualizar configuração',
    helpTitle: 'Antes de aplicar',
    helpDescription: 'Execute uma verificação recente primeiro. As alterações abrem no terminal do sistema; esta versão alfa não oferece desfazer automático.',
    checkingModule: 'Verificando {module}',
    applyingModule: 'Aplicando {module}',
    applyingAll: 'Aplicando todos os módulos',
    inProgress: 'A saída aparece em Ver registros enquanto o terminal do sistema está em execução. Confira se o terminal ficou atrás desta janela; não repita a operação.',
    showLogs: 'Ver registros',
    terminalAttention: 'A autenticação ocorre fora do navegador. Se o doas solicitar uma senha, digite-a somente no terminal separado do sistema.',
    blockBackend: 'A integridade do backend ou o esquema de diagnóstico não foi validado.',
    catalogLoading: 'Carregando o catálogo de módulos…',
    catalogUnavailable: 'O catálogo ao vivo de módulos está indisponível.',
    checkFirst: 'Execute uma verificação recente deste módulo em Verificar antes de aplicar. As verificações expiram após 10 minutos.',
    unknownDiagnostic: 'O diagnóstico do módulo retornou um estado desconhecido. Execute-o novamente antes de aplicar.',
    catalogMismatch: 'As dependências do diagnóstico não correspondem ao catálogo ao vivo. Atualize o diagnóstico antes de aplicar.',
    dependencyBlockers: (names) => `Verifique primeiro estas dependências e confirme que todas estão completas: ${names}.`,
  },
  nix: {
    eyebrow: 'CANAL NIX E APLICATIVOS',
    title: 'Somente Stable oficial.',
    detail: 'O Alpine Desktop Center não oferece um canal rolling ou Unstable. Atualizações do canal e aplicativos Nix permanecem no caminho Stable oficial.',
    currentChannel: 'CANAL ATUAL',
    checkBlocked: 'Verificação bloqueada',
    checkFailed: 'Verificação falhou',
    upToDate: 'Atualizado',
    updateAvailable: 'Atualização disponível',
    statusUnknown: 'Status desconhecido',
    notChecked: 'Não verificado',
    reportUnavailable: 'O endpoint oficial de status Stable não retornou uma resposta reconhecida.',
    runCheck: 'Verifique o canal Stable oficial instalado.',
    stableOnly: 'Somente Stable oficial',
    stablePolicy: 'Este app não oferece nem executa a troca para pacotes rolling ou Unstable.',
    checkChannel: 'Verificar canal Stable',
    refreshApps: 'Recarregar apps Nix no KDE',
    updateApps: 'Atualizar aplicativos Nix',
    appActionsDetail: 'Atualizar aplicativos altera o perfil Nix do usuário; recarregar apps no KDE reconstrói o menu e reinicia o Plasma, sem atualizar pacotes.',
    migrateStable: 'Migrar para o Stable mais recente',
    migrationRequirement: 'A migração exige uma verificação oficial bem-sucedida, feita nos últimos 10 minutos, que indique uma atualização.',
    noSwitch: 'Este aplicativo não oferece nem executa a troca para pacotes rolling ou Unstable.',
    openLog: 'Abrir registro',
  },
  history: {
    operationLabels: { 'validate-backend': 'Validar backend', 'check-all-modules': 'Verificar todos os módulos', 'system-check': 'Verificação do sistema', 'diagnose-module': 'Verificar módulo', 'apply-module': 'Aplicar módulo', 'apply-full': 'Aplicar todos os módulos', 'apply-diagnostics': 'Aplicar diagnósticos', 'simulate-full': 'Pré-visualizar configuração', 'check-stable-channel': 'Verificar canal Stable', 'refresh-nix-apps': 'Atualizar aplicativos Nix', 'update-nix-apps': 'Atualizar aplicativos Nix', 'refresh-kde-apps': 'Recarregar apps Nix no KDE', 'migrate-stable-channel': 'Migrar para Stable' },
    eyebrow: 'SESSÃO E REGISTROS PERSISTENTES',
    title: 'Histórico de operações',
    latestComplete: 'Última operação concluída.',
    latestFailed: 'A última operação falhou.',
    latestBlocked: 'A última operação foi bloqueada.',
    reportTitle: 'Resumo da sessão',
    description: 'Contagens da sessão e registros salvos das operações desta versão.',
    successfulApplies: 'Aplicações bem-sucedidas nesta sessão',
    failedBlocked: 'Operações com falha ou bloqueadas',
    sessionRecords: 'Registros da sessão',
    savedLogs: 'Registros salvos de operações',
    refresh: 'Atualizar histórico',
    refreshTitle: 'Atualizar histórico salvo de operações',
    savedOperationLogs: 'Registros salvos de operações',
    privateRelease: 'Privado a esta versão local',
    noLogs: 'Ainda não há registros de operações nesta versão.',
    logsCreatedBy: 'Uma verificação ou aplicação criará seu próprio registro salvo.',
    openLog: 'Abrir registro',
    currentSession: 'Sessão atual do navegador',
    overview: 'Visão geral',
    applyModules: 'Aplicar módulos',
    verifySystem: 'Verificar sistema',
  },
  inspector: {
    operationStatus: 'ESTADO DA OPERAÇÃO',
    protectedExecution: 'Execução protegida',
    ready: 'Pronto',
    noOperation: 'Nenhuma operação em andamento',
    operationInProgress: 'Operação em andamento',
    operationBlocked: 'Operação bloqueada',
    operationFailed: 'Operação com falha',
    operationComplete: 'Operação concluída',
    backendDetails: 'Detalhes técnicos',
    sessionAudit: 'AUDITORIA DA SESSÃO',
    activityStream: 'Atividade recente',
    recentEvents: 'Eventos recentes da sessão',
    refreshCurrent: 'Atualizar operação atual',
    showLogs: 'Ver registros',
    noActivity: 'Ainda não há atividade.',
    outputOriginal: 'Saída original',
  },
  confirmation: {
    previewTitle: 'Executar uma prévia completa da configuração?',
    applyAllTitle: 'Aplicar todos os módulos?',
    migrateTitle: 'Migrar para o canal Nix Stable oficial mais recente?',
    updateAppsTitle: 'Atualizar aplicativos Nix do perfil do usuário?',
    refreshKdeAppsTitle: 'Recarregar apps Nix no KDE?',
    applyModuleTitle: (name) => `Aplicar ${name}?`,
    previewDescription: 'O Ansible será executado em modo de verificação com diff somente se make, Ansible e o estado preparado local à versão já existirem; a ação não instala pré-requisitos. Esse modo é best-effort: tarefas de comando e shell sem suporte a check mode podem ser ignoradas.',
    applyAllDescription: 'As configurações atuais do backend podem instalar pacotes, ativar ou reconfigurar serviços, criar um arquivo swap de 12 GiB e atualizar parâmetros de inicialização para hibernação quando houver suporte.',
    migrateDescription: 'A operação atualiza o canal Nix configurado e executa nix-channel --update. Só é liberada se a verificação Stable oficial indicar uma versão mais nova.',
    updateAppsDescription: 'A operação atualiza aplicativos no perfil Nix do usuário atual. Revise a saída do terminal e confira o perfil depois.',
    refreshKdeAppsDescription: 'Reconstrói o cache do menu de aplicativos KDE e reinicia o Plasma após um breve intervalo. Não atualiza pacotes, não altera o perfil Nix e não reinicia o sistema.',
    applyModuleDescription: 'Esta função pode instalar ou atualizar pacotes e alterar serviços do sistema ou arquivos de configuração.',
    previewChange: 'Prévia em modo de verificação; ainda assim, best-effort.',
    profileChange: 'Esta ação altera o perfil Nix do usuário ou o canal.',
    desktopRefreshChange: 'O shell do Plasma será reiniciado na sessão atual; o painel pode desaparecer brevemente.',
    systemChange: 'Esta ação altera o sistema instalado.',
    previewAction: 'Executar prévia',
    migrateAction: 'Migrar Stable',
    updateAppsAction: 'Atualizar aplicativos Nix',
    refreshKdeAppsAction: 'Recarregar menu do KDE',
    confirmAction: 'Confirmar e executar',
    confirmPreview: 'CONFIRMAR PRÉVIA BEST-EFFORT',
    confirmChange: 'CONFIRMAR ALTERAÇÃO NO SISTEMA',
    confirmProfileChange: 'CONFIRMAR ALTERAÇÃO DO PERFIL NIX',
    confirmRefreshKde: 'CONFIRMAR ATUALIZAÇÃO DO DESKTOP',
    reviewAndSnapshot: 'Revise a saída do terminal antes de continuar; nos primeiros testes, use um snapshot descartável da VM.',
    refreshKdeReview: 'O menu e o painel do KDE podem recarregar brevemente enquanto o Plasma reinicia.',
    acknowledgement: 'Entendo que esta operação pode alterar o sistema, o perfil Nix ou o estado local desta versão.',
    refreshKdeAcknowledgement: 'Entendo que esta ação reconstrói o menu de aplicativos do KDE e reinicia o Plasma, sem atualizar pacotes Nix.',
    cancel: 'Cancelar',
  },
  logs: {
    ariaLabel: 'Registros da operação',
    eyebrow: 'REGISTROS DA OPERAÇÃO',
    title: 'Saída do backend',
    close: 'Fechar registros',
    currentState: 'ESTADO ATUAL',
    running: 'Operação em andamento',
    failed: 'Operação com falha',
    blocked: 'Operação bloqueada',
    finished: 'Operação concluída',
    waiting: 'Aguardando uma operação',
    namedCommand: 'Comando nomeado',
    systemTerminalWarning: 'Esta operação é executada em um terminal separado do sistema. Se for solicitada autenticação, digite as credenciais somente ali. Não as digite no navegador.',
    savedLog: 'Registro salvo',
    terminalTitle: 'activity.log · sessão atual',
    waitingOutput: 'Aguardando a saída local da operação…',
    refresh: 'Atualizar operação atual',
    show: 'Ver registros',
    noOutput: 'Nenhuma saída foi registrada ainda.',
  },
  savedLog: {
    ariaLabel: 'Registro salvo da operação',
    eyebrow: 'REGISTRO PERSISTENTE DA OPERAÇÃO',
    close: 'Fechar registro salvo',
    savedLog: 'Registro salvo',
    savedHistory: 'histórico salvo',
    loading: 'Carregando registro salvo…',
    empty: '(O registro salvo está vazio.)',
    readError: 'Não foi possível ler o registro salvo da operação.',
  },
  states: {
    operation: { idle: 'Pronta', running: 'Em execução', waiting: 'Aguardando', success: 'Concluída', error: 'Falhou', blocked: 'Bloqueada' },
    history: { success: 'Concluída', error: 'Falhou', blocked: 'Bloqueada', running: 'Em execução', unknown: 'Desconhecido' },
    module: { Ready: 'Pronto', 'Needs attention': 'Requer atenção', 'Not detected': 'Não detectado', Unknown: 'Desconhecido' },
    diagnostic: { complete: 'Completo', partial: 'Parcial', incomplete: 'Incompleto', unknown: 'Desconhecido' },
    check: { ok: 'APROVADO', warning: 'AVISO', error: 'AUSENTE', unknown: 'DESCONHECIDO' },
    logLevel: { info: 'INFO', success: 'SUCESSO', warning: 'AVISO', error: 'ERRO' },
  },
  modules: {
    names: { base: 'Base', audio: 'Áudio', energia: 'Energia', fontes: 'Fontes', kde: 'KDE Plasma', bluetooth: 'Bluetooth', rede: 'Rede', nix: 'Nix', nix_opengl: 'Nix com OpenGL', steam: 'Steam', swap: 'Memória swap' },
    descriptions: {
      base: 'Pacotes essenciais do desktop Alpine e permissões.', audio: 'PipeWire, WirePlumber e áudio da sessão.', energia: 'Configurações de energia e hibernação do desktop.', fontes: 'Fontes e configuração tipográfica do desktop.', kde: 'Desktop KDE Plasma e compatibilidade com OpenRC.', bluetooth: 'Serviços Bluetooth e suporte a dispositivos.', rede: 'NetworkManager e dispositivos de rede gerenciados.', nix: 'Gerenciador Nix e integração com o perfil do usuário.', nix_opengl: 'Suporte OpenGL para aplicativos instalados com Nix.', steam: 'Pilha de jogos e aplicativos Steam via Nix.', swap: 'Espaço swap e suporte à hibernação.',
    },
  },
  messages: {
    checkingBridge: 'Verificando a ponte local do navegador…',
    unsupportedSchema: (schema) => `Esquema de diagnóstico não compatível: ${schema}. As operações estão bloqueadas.`,
    bridgeUnavailable: 'A ponte com o backend local não está conectada.',
    catalogUnavailable: 'Não foi possível carregar o catálogo de módulos.',
    historyRefreshFailed: (detail) => `Não foi possível atualizar o histórico salvo: ${detail}`,
    savedLogReadFailed: (detail) => `Não foi possível ler o registro salvo: ${detail}`,
    blockedBackend: 'As operações estão bloqueadas até que a ponte local valide o backend.',
    blockedLabel: (label) => `${label} foi bloqueada porque a integridade do backend não foi validada.`,
    startingOperation: (label) => `Iniciando operação nomeada: ${label}`,
    openingChannel: 'Abrindo o canal protegido de operação local…',
    operationBlocked: (detail) => `Operação bloqueada: ${detail}`,
    httpError: (status) => `A ponte local retornou HTTP ${status}`,
    missingSession: 'A ponte local não retornou uma sessão de operação.',
    deadline: 'A operação excedeu o limite de segurança da interface. Confira o terminal do sistema e o registro antes de tentar novamente.',
    operationFailed: (label, detail) => `${label} falhou: ${detail}`,
    operationComplete: (label, detail) => `${label}: ${detail}`,
    migrationNotAllowed: 'Execute primeiro uma verificação Stable oficial recente e bem-sucedida; a migração só é permitida se ela indicar uma atualização.',
    outputRefreshFailed: (detail) => `Não foi possível atualizar a saída da operação: ${detail}`,
    validationRecheckFailed: (detail) => `Falha ao revalidar o backend: ${detail}`,
  },
}

export const copy: Record<Locale, UiCopy> = { 'pt-BR': pt, 'en-US': en }

export function initialLocale(): Locale {
  const saved = window.localStorage.getItem('alpine-desktop-center-locale')
  if (saved === 'pt-BR' || saved === 'en-US') return saved
  return window.navigator.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US'
}

export function formatDate(value: number | string, locale: Locale): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale)
}
