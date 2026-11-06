export type Locale = 'pt-BR' | 'en-US'

export type UiCopy = {
  language: string
  languagePt: string
  languageEn: string
  languagePtFull: string
  languageEnFull: string
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
    purposeLabel: string
    purposeBaseTitle: string
    purposeBaseDescription: string
    purposeAppsTitle: string
    purposeAppsDescription: string
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
  language: 'Language',
  languagePt: 'BR',
  languageEn: 'US',
  languagePtFull: 'Brazilian Portuguese',
  languageEnFull: 'English (United States)',
  nav: {
    welcome: { label: 'Welcome', note: 'Release overview' },
    validate: { label: 'Backend', note: 'Integrity lock' },
    checks: { label: 'System check', note: 'Read-only signals' },
    modules: { label: 'Modules', note: 'Apply modules' },
    config: { label: 'Configuration', note: 'Stable choices' },
    summary: { label: 'Summary', note: 'Review outcome' },
  },
  chrome: {
    workspaceSections: 'WORKSPACE SECTIONS',
    localWorkspace: 'Local system workspace',
    independentOperations: 'Independent operations',
    integrityLock: 'Integrity lock',
    backendVerified: 'Backend and schema verified',
    notVerified: 'Not verified',
    releaseSource: 'Release source',
    alpineWorkspace: 'ALPINE WORKSPACE',
    frontend: 'FRONTEND',
    backend: 'BACKEND',
    toggleTheme: 'Toggle theme',
    workspaceSection: 'WORKSPACE SECTION',
    unknown: 'unknown',
    localBridgeValidated: 'Local bridge validated',
    bridgeBlocked: 'Bridge reachable · integrity/schema blocked',
    bridgeOffline: 'Local bridge offline',
  },
  welcome: {
    heading: 'Alpine’s stable base. Your desktop, expanded.',
    lede: 'Configure an Alpine desktop that is already installed with Stable foundations, Nix applications, and practical desktop modules—while keeping checks and changes visible.',
    systemWorkspace: 'SYSTEM WORKSPACE',
    heroTitle: 'A stable Alpine base.',
    heroTitleAccent: 'A desktop built your way.',
    heroDescription: 'Alpine Desktop Center configures an existing Alpine Linux desktop, bringing Nix applications and desktop modules together with visible checks before changes.',
    purposeLabel: 'WHAT IT BRINGS TOGETHER',
    purposeBaseTitle: 'Alpine Linux Stable',
    purposeBaseDescription: 'A light, stable foundation for your desktop.',
    purposeAppsTitle: 'Nix applications',
    purposeAppsDescription: 'Manage user-profile apps through the configured Stable channel.',
    purposeModulesTitle: 'Desktop modules',
    purposeModulesDescription: 'Audio, Bluetooth, NetworkManager, KDE, and more.',
    scopeNote: 'It configures an existing Alpine install; it does not install the operating system.',
    inspectRelease: 'Inspect the release',
    browseModules: 'Browse modules',
    currentSnapshot: 'CURRENT SNAPSHOT',
    systemSignals: 'System signals',
    openSystemCheck: 'Open system check',
    backendIntegrity: 'Backend integrity',
    validated: 'Validated',
    blocked: 'Blocked',
    unavailable: 'Unavailable',
    releaseState: 'Release state',
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
    refreshBackend: 'Refresh backend integrity',
    checkStable: 'Check official Stable channel',
    openLog: 'Open log',
    savedLogs: 'Saved logs',
  },
}

const pt: UiCopy = {
  language: 'Idioma',
  languagePt: 'BR',
  languageEn: 'US',
  languagePtFull: 'Português brasileiro',
  languageEnFull: 'Inglês dos Estados Unidos',
  nav: {
    welcome: { label: 'Início', note: 'Visão da versão' },
    validate: { label: 'Backend', note: 'Bloqueio de integridade' },
    checks: { label: 'Verificação do sistema', note: 'Sinais somente leitura' },
    modules: { label: 'Módulos', note: 'Aplicar módulos' },
    config: { label: 'Configuração', note: 'Opções Stable' },
    summary: { label: 'Resumo', note: 'Revisar resultado' },
  },
  chrome: {
    workspaceSections: 'SEÇÕES DO WORKSPACE',
    localWorkspace: 'Workspace do sistema local',
    independentOperations: 'Operações independentes',
    integrityLock: 'Bloqueio de integridade',
    backendVerified: 'Backend e schema verificados',
    notVerified: 'Não verificado',
    releaseSource: 'Origem da versão',
    alpineWorkspace: 'WORKSPACE ALPINE',
    frontend: 'FRONTEND',
    backend: 'BACKEND',
    toggleTheme: 'Alternar tema',
    workspaceSection: 'SEÇÃO DO WORKSPACE',
    unknown: 'desconhecido',
    localBridgeValidated: 'Bridge local validado',
    bridgeBlocked: 'Bridge acessível · integridade/schema bloqueados',
    bridgeOffline: 'Bridge local offline',
  },
  welcome: {
    heading: 'A base Alpine. Seu desktop, ampliado.',
    lede: 'Configure um desktop Alpine já instalado com a base Stable, aplicativos Nix e módulos práticos — com verificações e mudanças visíveis.',
    systemWorkspace: 'WORKSPACE DO SISTEMA',
    heroTitle: 'Uma base Alpine estável.',
    heroTitleAccent: 'Seu desktop, ampliado.',
    heroDescription: 'O Alpine Desktop Center configura um desktop Alpine Linux já instalado e reúne aplicativos Nix a módulos de desktop, mostrando o que será verificado e alterado.',
    purposeLabel: 'O QUE A FERRAMENTA REÚNE',
    purposeBaseTitle: 'Base Alpine Linux Stable',
    purposeBaseDescription: 'Uma fundação leve e estável para o desktop.',
    purposeAppsTitle: 'Aplicativos Nix',
    purposeAppsDescription: 'Gerencie apps no perfil do usuário pelo canal Stable configurado.',
    purposeModulesTitle: 'Módulos de desktop',
    purposeModulesDescription: 'Áudio, Bluetooth, NetworkManager, KDE e outros ajustes.',
    scopeNote: 'Configura um Alpine já instalado; não instala o sistema operacional.',
    inspectRelease: 'Inspecionar a versão',
    browseModules: 'Ver módulos',
    currentSnapshot: 'VISÃO ATUAL',
    systemSignals: 'Sinais do sistema',
    openSystemCheck: 'Abrir verificação',
    backendIntegrity: 'Integridade do backend',
    validated: 'Validado',
    blocked: 'Bloqueado',
    unavailable: 'Indisponível',
    releaseState: 'Estado da versão',
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
    refreshBackend: 'Atualizar integridade do backend',
    checkStable: 'Verificar canal Stable oficial',
    openLog: 'Abrir log',
    savedLogs: 'Logs salvos',
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
