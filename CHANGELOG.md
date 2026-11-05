# Changelog

## 0.1.0-alpha.24-web — candidata de teste, ainda não publicada

- Removido o endpoint de texto livre para entrada no PTY do browser. Apply exige confirmação e autenticação ocorre em terminal externo; refresh de apps Nix e migração Stable também usam esse caminho. O token é gerado por lançamento, gravado atomicamente em arquivo privado e entregue à UI apenas por cookie `HttpOnly; SameSite=Strict`.
- O bridge é loopback-only, verifica endereço remoto e Host/Origin estritos, recusa bind fora de `127.0.0.1`, rejeita manifestos inválidos/symlinks e só aceita metadata de diagnóstico schema 1. O launcher e o servidor usam locks para evitar inicializações concorrentes.
- Apply de módulo exige diagnóstico recente para o módulo, lista de dependências coerente com o catálogo e diagnósticos `complete` recentes para cada dependência, no cliente e no servidor. Warnings deixam de aparecer como sucesso sem ressalvas; resultados JSON, catálogo e estados têm validação runtime.
- Migração Nix Stable exige relatório oficial, coerente e recente (`update_available`) tanto na UI quanto no bridge; checks expirados, falhos, inválidos e mutações anteriores não autorizam migração. Validate again atualiza health e catálogo após reparo bem-sucedido.
- A prévia `make simular` bloqueia sem dependências/estado Ansible já preparado e não instala pré-requisitos automaticamente. Continua best-effort: o check mode pode ignorar tarefas e não substitui revisão de efeitos.
- PTY tem limites de output, timeout, rastreamento de descendentes e hard stop; o bridge bloqueia retries quando detecta PID residual. Logs têm retenção limitada e os temporários do terminal são limpos nos caminhos tratados.
- O backend incluído é read-only por padrão. O empacotador exige frontend limpo, lockfile congelado, versão consistente, backend Git verificável e SHA imutável do v1.43 (sem override); valida o pacote antes de criar tarball determinístico. O CI também constrói e valida o tarball extraído/manifesto, sem publicar.
- A suíte do bridge cobre manifestos, cookies, locks, loopback, schema, diagnóstico/dependências, prévia bloqueada, logs, allowlist e timeouts, incluindo descendente detached via `setsid`.

Esta candidata **não é uma versão estável**. O backend v1.43 ainda instala uma regra ampla `doas nopass` que pode persistir após encerramento abrupto; a prévia é incompleta, não há licença escolhida e não houve teste em VM Alpine. Usar somente em VM descartável com snapshot; não aplicar em máquina de produção.

## 0.1.0-alpha.5

Secured the loopback bridge with a per-launch session token, loopback Host/Origin validation, strict JSON operation requests and JSON API 404 responses. Added server-side operation locking, process-group timeout cleanup, version-namespaced operation logs, module catalog and log listing endpoints. The launcher now waits for authenticated health before opening the app window. The frontend consumes the authenticated health and module catalog instead of presenting fixed validation state as current fact.

## 0.1.0-alpha.4

The local bridge now executes the real v1.43 backend targets through a closed allowlist: structured module diagnostics, Stable Nix channel checks/migration, Nix application updates, full Apply, diagnostic Apply and module Apply. Every command is revalidated against the embedded SHA-256 manifest immediately before execution, and output is saved inside `.alpine-state/web/operations/`. The unused profile avatar was removed.

The workspace sections are intentionally independent again. Users can open any section at any time, check one module without changing it, or apply only the selected module, matching the legacy Qt behavior.

Fixed a local bridge bug that split single commands into characters in the activity log. Stable channel checks now execute the correct argument vector, and the remaining PipeWire status message is normalized to English in the browser output.

## 0.1.0-alpha.3

This revision replaces the previous improvised palette with the user's Rokko visual reference: light gray workspace surfaces, white content panels, deep institutional green navigation, vivid green selection states, dark readable typography and restrained borders. Agama/openSUSE remains a structural reference for clarity, not a color or branding reference.

## 0.1.0-alpha.2

This iteration makes the local browser UI behave like a dedicated installer window rather than a normal browser tab. The launcher uses an isolated Chromium app window or Firefox kiosk mode, blocks future installer steps until the current step is completed, and corrects the light theme surfaces and visual hierarchy.

## Web era — 0.1.0-alpha.1

This release establishes the browser-first line of Alpine Desktop Center.

- Added a browser installer flow inspired by system installers.
- Added explicit steps for welcome, backend validation, system checks, modules, configuration, execution and summary.
- Added local-only launcher support with a Python HTTP server bound to `127.0.0.1`.
- Added embedded backend manifest validation through the local bridge.
- Added a portable two-click package layout without external hosting.
- Preserved the backend as the source of truth and kept arbitrary shell execution out of the browser contract.
