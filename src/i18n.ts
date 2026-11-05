export type Locale = 'pt-BR' | 'en-US'

export type UiCopy = {
  language: string
  languagePt: string
  languageEn: string
  nav: Record<string, { label: string; note: string }>
  chrome: {
    workspaceSections: string
    localWorkspace: string
    independentOperations: string
    integrityLock: string
    backendVerified: string
    notVerified: string
    releaseSource: string
    alpineWorkspace: string
    frontend: string
    backend: string
    toggleTheme: string
    workspaceSection: string
    unknown: string
    localBridgeValidated: string
    bridgeBlocked: string
    bridgeOffline: string
  }
  welcome: {
    heading: string
    lede: string
    systemWorkspace: string
    heroTitle: string
    heroTitleAccent: string
    heroDescription: string
    inspectRelease: string
    browseModules: string
    currentSnapshot: string
    systemSignals: string
    openSystemCheck: string
    backendIntegrity: string
    validated: string
    blocked: string
    unavailable: string
    releaseState: string
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
    refreshBackend: string
    checkStable: string
    openLog: string
    savedLogs: string
  }
}

const en: UiCopy = {
  language: 'Language', languagePt: 'Português', languageEn: 'English',
  nav: {
    welcome: { label: 'Welcome', note: 'Release overview' }, validate: { label: 'Backend', note: 'Integrity lock' },
    checks: { label: 'System check', note: 'Read-only signals' }, modules: { label: 'Modules', note: 'Apply modules' },
    config: { label: 'Configuration', note: 'Stable choices' }, summary: { label: 'Summary', note: 'Review outcome' },
  },
  chrome: {
    workspaceSections: 'WORKSPACE SECTIONS', localWorkspace: 'Local system workspace', independentOperations: 'Independent operations', integrityLock: 'Integrity lock',
    backendVerified: 'Backend and schema verified', notVerified: 'Not verified', releaseSource: 'Release source', alpineWorkspace: 'ALPINE WORKSPACE', frontend: 'FRONTEND', backend: 'BACKEND',
    toggleTheme: 'Toggle theme', workspaceSection: 'WORKSPACE SECTION', unknown: 'unknown', localBridgeValidated: 'Local bridge validated', bridgeBlocked: 'Bridge reachable · integrity/schema blocked', bridgeOffline: 'Local bridge offline',
  },
  welcome: {
    heading: 'See the system. Decide the change.', lede: 'One clear workspace for inspection, decisions and safe changes. Nothing is hidden behind a generic success state.', systemWorkspace: 'SYSTEM WORKSPACE', heroTitle: 'Make the next step', heroTitleAccent: 'obvious and accountable.', heroDescription: 'Inspect the current system, choose a bounded action, and keep its evidence with you from start to finish. These sections are independent; there is no required path to follow.', inspectRelease: 'Inspect the release', browseModules: 'Browse modules', currentSnapshot: 'CURRENT SNAPSHOT', systemSignals: 'System signals', openSystemCheck: 'Open system check', backendIntegrity: 'Backend integrity', validated: 'Validated', blocked: 'Blocked', unavailable: 'Unavailable', releaseState: 'Release state', stableChannel: 'Stable channel', stableUpToDate: 'Up to date', stableUpdateAvailable: 'Update available', stableCheckFailed: 'Check failed', stableBlocked: 'Blocked', stableUnknown: 'Status unknown', stableNotChecked: 'Not checked', lastVerification: 'Last verification', latestStable: 'Latest Stable', noStableCheck: 'No saved Stable channel check yet.', refreshBackend: 'Refresh backend integrity', checkStable: 'Check official Stable channel', openLog: 'Open log', savedLogs: 'Saved logs',
  },
}

const pt: UiCopy = {
  language: 'Idioma', languagePt: 'Português', languageEn: 'English',
  nav: {
    welcome: { label: 'Início', note: 'Visão da versão' }, validate: { label: 'Backend', note: 'Bloqueio de integridade' },
    checks: { label: 'Verificação do sistema', note: 'Sinais somente leitura' }, modules: { label: 'Módulos', note: 'Aplicar módulos' },
    config: { label: 'Configuração', note: 'Opções Stable' }, summary: { label: 'Resumo', note: 'Revisar resultado' },
  },
  chrome: {
    workspaceSections: 'SEÇÕES DO WORKSPACE', localWorkspace: 'Workspace do sistema local', independentOperations: 'Operações independentes', integrityLock: 'Bloqueio de integridade',
    backendVerified: 'Backend e schema verificados', notVerified: 'Não verificado', releaseSource: 'Origem da versão', alpineWorkspace: 'WORKSPACE ALPINE', frontend: 'FRONTEND', backend: 'BACKEND',
    toggleTheme: 'Alternar tema', workspaceSection: 'SEÇÃO DO WORKSPACE', unknown: 'desconhecido', localBridgeValidated: 'Bridge local validado', bridgeBlocked: 'Bridge acessível · integridade/schema bloqueados', bridgeOffline: 'Bridge local offline',
  },
  welcome: {
    heading: 'Veja o sistema. Decida a mudança.', lede: 'Um workspace claro para inspeção, decisões e mudanças seguras. Nada fica escondido atrás de um sucesso genérico.', systemWorkspace: 'WORKSPACE DO SISTEMA', heroTitle: 'Torne o próximo passo', heroTitleAccent: 'claro e rastreável.', heroDescription: 'Inspecione o sistema atual, escolha uma ação delimitada e acompanhe suas evidências do início ao fim. As seções são independentes; não há um caminho obrigatório.', inspectRelease: 'Inspecionar a versão', browseModules: 'Ver módulos', currentSnapshot: 'VISÃO ATUAL', systemSignals: 'Sinais do sistema', openSystemCheck: 'Abrir verificação', backendIntegrity: 'Integridade do backend', validated: 'Validado', blocked: 'Bloqueado', unavailable: 'Indisponível', releaseState: 'Estado da versão', stableChannel: 'Canal Stable', stableUpToDate: 'Atualizado', stableUpdateAvailable: 'Atualização disponível', stableCheckFailed: 'Verificação falhou', stableBlocked: 'Bloqueado', stableUnknown: 'Status desconhecido', stableNotChecked: 'Não verificado', lastVerification: 'Última verificação', latestStable: 'Última versão Stable', noStableCheck: 'Ainda não há verificação Stable salva.', refreshBackend: 'Atualizar integridade do backend', checkStable: 'Verificar canal Stable oficial', openLog: 'Abrir log', savedLogs: 'Logs salvos',
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
