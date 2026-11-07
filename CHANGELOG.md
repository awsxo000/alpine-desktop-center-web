# Changelog

## 0.1.0-alpha.50-web — identidade visual e busca Nix mais rápida
- Renova o símbolo da marca, o ícone do aplicativo, o favicon e o SVG usado pelo launcher, mantendo a identidade Alpine em azul, verde e navy.
- Melhora a hierarquia visual dos ícones, cards, estados vazios e controles do painel Nix.
- Impede que busca e listagem de aplicativos Nix abram o modal de terminal; essas consultas permanecem na interface do navegador.
- Adiciona estado de carregamento e cache de cinco minutos para consultas repetidas do catálogo Nix, invalidado após alterações no perfil ou canal.
- Mantém instalação e desinstalação com confirmação explícita e terminal externo, sem aceitar shell arbitrário.
- Validação: `pnpm check`, `pnpm build` e 55 testes (`pnpm test`).

## 0.1.0-alpha.40-web — paridade real entre temas
- Remove as regras exclusivas de tamanho do modo claro que aumentavam fontes, line-heights, paddings, gaps e dimensões de componentes.
- Mantém no tema claro somente ajustes de contraste, cores de estado e legibilidade; a geometria passa a vir das mesmas regras compartilhadas pelo modo escuro.
- Preserva a acessibilidade visual sem alterar operações do backend, fluxo mobile ou componentes funcionais.
- Validação: `pnpm check`, 45 testes (`pnpm test`), `pnpm build` e `git diff --check`.

## 0.1.0-alpha.39-web — equilíbrio entre temas e sinais do ambiente
- Equaliza a geometria do modo claro e do modo escuro: hero, tipografia, colunas, espaçamentos e dimensões permanecem consistentes; apenas a identidade cromática muda.
- Adiciona ao Welcome um painel compacto de sinais do ambiente com módulos disponíveis, diagnósticos da sessão e operações salvas.
- Mantém os indicadores ligados ao estado real do bridge e traduzidos em PT-BR e EN-US.
- Centraliza a nova camada visual em `src/theme-balance.css`, preservando o fluxo mobile e evitando alterações nas operações do backend.
- Validação: `pnpm check`, 45 testes (`pnpm test`), `pnpm build` e `git diff --check`.

## 0.1.0-alpha.38-web — compactação e coesão visual
- Reduz o espaço vertical ocioso no desktop, aproximando cabeçalho, título, descrição e conteúdo principal.
- Compacta cards, painéis, listas, áreas de diagnóstico, terminal e histórico sem remover informações ou ações.
- Mantém o fluxo mobile separado, preservando o comportamento responsivo em telas pequenas.
- Centraliza os ajustes em `src/density.css`, carregado após as folhas existentes para evitar regressões causadas pela cascata de estilos.
- Validação: `pnpm check`, `pnpm test`, `pnpm build` e `git diff --check`.

## 0.1.0-alpha.37-web — verificação em dois fatores por módulo
- Distingue explicitamente o **estado atual do sistema** (pacotes, serviços e configurações que já existem) da **prontidão para aplicar** (diagnóstico recente do módulo, dependências declaradas com diagnóstico completo e integridade dos arquivos do backend embarcado pelo manifesto SHA-256).
- O painel Aplicar mostra os dois resultados lado a lado e explica bloqueios; um módulo incompleto no sistema não é tratado como prova de que está proibido instalá-lo.
- A página Verificar explica a diferença em PT-BR e EN-US. A lógica existente de autorização de Apply permanece a fonte de verdade; nenhuma operação do sistema foi executada.
- Validação: `pnpm check`, 45 testes (`pnpm test`), `pnpm build` e `git diff --check`; captura visual desktop não realizada porque o navegador headless não está instalado no sandbox.

## 0.1.0-alpha.36-web — logs organizados por destino e ação
- Substitui o destino genérico para novos registros por pastas fáceis de reconhecer em `.alpine-state/web/<versão>/logs/`: `verify/`, `apply/` e `nix/`, com subpastas por ação e por módulo quando aplicável.
- Exemplos: verificação Stable em `logs/nix/stable-check/`, atualização do perfil Nix em `logs/nix/profile-apps/` e refresh/reinício do KDE em `logs/nix/kde-refresh/`; o Histórico continua exibindo o caminho exato e abrindo cada log pelo ID.
- Preserva e continua listando/abrindo arquivos legados em `operations/general/` e `operations/modules/`; a retenção e as permissões privadas são aplicadas sobre a árvore completa.
- Validação: typecheck, build, `git diff --check` e 45 testes do bridge; nenhuma operação real no Alpine foi executada.

## 0.1.0-alpha.35-web — atualização Nix e refresh KDE separados
- Restaura **Refresh Nix apps** como ação distinta: chama o script KDE embutido para reconstruir o menu de aplicativos e reiniciar o shell Plasma na sessão atual, sem atualizar pacotes nem alterar o perfil Nix.
- Mantém **Update Nix apps** para atualizar os aplicativos do perfil do usuário; cada ação tem rótulo, descrição e confirmação próprios em EN-US e PT-BR.
- O bridge registra `refresh-kde-apps` como operação nomeada não privilegiada; `update-nix-apps` é o identificador explícito da atualização de perfil, e `refresh-nix-apps` continua aceito como alias legado dessa atualização.
- Validação: `pnpm check`, 43 testes (`pnpm test`), `pnpm build` e `git diff --check`; prévia desktop em 1440×900 inspecionada em EN-US e PT-BR. Nenhuma operação de sistema/KDE foi executada; ainda é necessária validação numa VM Alpine descartável.
- Mantém backend `v1.44-dev` no commit `52712cb7872792c04495d8b63d1a917a35861e31`; nenhuma regra `doas` ou política de privilégio foi alterada.

## 0.1.0-alpha.34-web — cinco destinos e localização ampla
- Reorganiza a navegação em **Início, Verificar, Aplicar, Nix e Histórico**: diagnósticos ficam separados da aplicação; canal Stable e manutenção de apps Nix dividem um destino; sessão e logs persistentes passam a uma fonte canônica.
- Amplia a tradução PT-BR para títulos, instruções e estados técnicos; o seletor conciso permanece **BR/US**.
- Reduz redundâncias visuais: remove o chip lateral repetitivo, transforma o resumo inicial em duas etapas claras e aproveita a largura do desktop com colunas balanceadas e rolagem global dispensável.
- Corrige o título de validação para descrever integridade do backend da versão sem afirmar um bloqueio ativo quando a ponte está desconectada; a falha agora é visualmente distinta do estado de sucesso.
- Validação: `pnpm check`, 42 testes (`pnpm test`), `pnpm build` e `git diff --check`; inspeção Chromium em 1440×900 e 1920×1080, cinco destinos, troca BR/US, sem erros JS nem rolagem global nos estados verificados. Não houve teste operacional em Alpine real; usar VM descartável com snapshot.
- Mantém o backend `v1.44-dev` pinado ao commit `52712cb7872792c04495d8b63d1a917a35861e31`; nenhuma operação privilegiada ou regra `doas` foi alterada.

## 0.1.0-alpha.33-web — tela cheia, onboarding e polimento visual
- Chromium, Chromium Browser e Google Chrome passam a abrir em fullscreen app mode; Firefox mantém seu modo kiosk.
- O seletor de idioma no cabeçalho exibe somente **BR** e **US**, com nomes completos preservados para acessibilidade e preferência local persistente.
- A página Welcome explica que a ferramenta configura um Alpine já instalado, integra a base Stable com aplicativos Nix e módulos de desktop (áudio, Bluetooth, NetworkManager, KDE) e não instala o sistema operacional.
- Redesenha a marca vetorial de montanhas Alpine e ponto central; o símbolo é usado no app, favicon e launcher do desktop.
- Amplia o uso horizontal da viewport, adiciona rolagem interna quando a altura/zoom exige e troca o hover escuro dos botões primários por elevação, borda e sombra sutis, com foco por teclado visível.
- Mantém o backend candidato `v1.44-dev` pinado ao commit `52712cb7872792c04495d8b63d1a917a35861e31`; nenhum comportamento privilegiado foi alterado.
- Validação local: `pnpm check`, `pnpm test` (42 testes), `pnpm build`, sintaxe dos launchers e integridade do diff aprovados; prévias visuais em 1920×1080, 1366×768 e viewport compacta sem rolagem global nem corte interno do Welcome.
- Continua sem validação operacional em Alpine real; testar em VM descartável com snapshot antes de uso estável.

## 0.1.0-alpha.32-web — suporte de idioma e status Stable mais claro
- Adds a visible top-bar selector between **Português brasileiro** and **English**, with the preference persisted locally in the browser.
- Translates the application chrome and Welcome screen according to the selected language.
- Welcome now shows the last Stable-channel verification date/time and the latest Stable version reported by the official source, with a direct **Open log** action for the saved check.

## 0.1.0-alpha.31-web — System Check, histórico e canal Stable

- **Welcome:** os sinais de integridade do backend e canal Stable agora têm atualização real. O bridge revalida o manifesto e catálogo, e o último resultado Stable é reconstruído do log salvo ao reabrir o app; uma instalação limpa continua em **Not checked**. Respostas iniciais atrasadas não sobrescrevem um check concluído depois.
- **System Check:** concentra diagnósticos individuais e de todos os módulos, status por componente e histórico local de operações. Logs podem ser abertos pelo identificador gerado, sem expor endpoints de caminho arbitrário; GETs de status/histórico não criam diretórios nem alteram permissões, e o endpoint Stable não autoriza migração com evidência histórica.
- **Modules:** fica dedicado a aplicar módulo ou configuração completa. **Configuration** oferece apenas política Stable e não exibe switch Unstable nem Apply all; a tela Summary agora apresenta contadores, logs persistidos e navegação para os fluxos.
- Ajusta contraste, títulos, controles de status/canal e superfícies em tema escuro. Reduz a altura ociosa no painel de aplicação, mantendo listas, detalhes longos e histórico com rolagem delimitada.
- Documenta em português a hierarquia/caminho de logs, inclui o guia no pacote e acrescenta testes de regressão para histórico, logs protegidos, symlink/traversal e o estado Stable inicial/persistido.
- Mantém o backend `v1.44-dev` no commit `52712cb7872792c04495d8b63d1a917a35861e31`. O Undo automático permanece fora desta versão: ainda é necessário snapshot externo de VM.

Validação automatizada: `pnpm check`, `pnpm build`, compilação Python e 40 testes do bridge passam. A prévia visual de sandbox confirma contraste em tema escuro, Modules compacto e rolagens contidas, mas estava sem bridge Alpine; esta candidata não foi testada operacionalmente em Alpine real. Testar em VM descartável com snapshot antes de qualquer uso estável.
- Mantém o backend `v1.44-dev` no commit `52712cb7872792c04495d8b63d1a917a35861e31`. O Undo automático permanece fora desta versão: ainda é necessário snapshot externo de VM.

Validação automatizada: `pnpm check`, `pnpm build`, compilação Python e 40 testes do bridge passam. A prévia visual de sandbox confirma contraste em tema escuro, Modules compacto e rolagens contidas, mas estava sem bridge Alpine; esta candidata não foi testada operacionalmente em Alpine real. Testar em VM descartável com snapshot antes de qualquer uso estável.

## 0.1.0-alpha.30-web — polimento visual de Modules e Session Audit

- A área **Session Audit** agora mostra até 100 eventos recentes num viewport com rolagem própria; mensagens longas quebram linha e não ocupam o lugar de cartões vizinhos. A ação **Show logs** continua oferecendo o histórico completo.
- Compacta o catálogo visual para ícone Lucide específico e nome de módulo, mantendo status como indicador acessível. O detalhe selecionado aproveita melhor a altura, organiza estado/descrição/bloqueios e alinha as ações; a orientação “Need to understand a step?” aparece logo abaixo do detalhe.
- Ajusta o hover de Check status, Apply e seleção de módulos, com cores explícitas e distintas para tema claro/escuro; controles desabilitados não fingem interação.
- Mantém o backend `v1.44-dev` fixado no commit `52712cb7872792c04495d8b63d1a917a35861e31`; não altera o modelo de autorização/rollback.

Verificada visualmente em preview sandbox no tema claro e escuro. A preview estava sem o bridge Alpine ligado; isso não valida execução nem substitui teste em VM. Continua alpha: testar layout, eventos longos e estado hover/foco no Alpine real antes de considerar estabilidade.

## 0.1.0-alpha.29-web — candidata de observabilidade e layout

- Transmite incrementalmente ao navegador o output do terminal do sistema e grava no log privado enquanto o Apply ainda executa; o prompt de senha continua exclusivamente no terminal externo. A leitura incremental mantém `O_NOFOLLOW`, valida ownership/permissões e tem teste que comprova output visível antes do fim do comando.
- Reorganiza Modules em dois painéis: lista de módulos e detalhe/checks com rolagem interna confinada. Layout responsivo empilha os painéis em telas estreitas e evita redimensionar a página inteira.
- A auditoria das 11 roles concluiu que nenhuma guarda baseline suficiente para um Undo completo. Esta candidata não oferece rollback automático inferido; operação anterior sem snapshot deve ser recuperada por snapshot da VM, quando existente. Uma futura reversão precisa de snapshot por módulo, verificação de drift, preview e confirmação.
- Mantém o backend `v1.44-dev` fixado no commit `52712cb7872792c04495d8b63d1a917a35861e31`.

Alpha para teste de integração em VM descartável com snapshot. A saída da execução alpha.28 já iniciada não muda com esta build; o novo streaming vale somente depois de instalar/lançar a alpha.29. Testes automatizados não substituem validação em Alpine real.

## 0.1.0-alpha.28-web — candidata para retry de canal Nix

- Corrige a falha reproduzida na VM depois de uma atualização Nix interrompida por TLS/data do sistema: o URL do canal podia ficar cadastrado mesmo sem o conteúdo ter sido baixado; a próxima aplicação agora consulta o cache do usuário e repete `nix-channel --update` antes de procurar pacotes como `nixpkgs.steam`.
- Acrescenta teste de regressão garantindo o retry quando o cache local do canal não existe.
- Fixa o backend `v1.44-dev` no commit `52712cb7872792c04495d8b63d1a917a35861e31`.

Alpha destinada a novo teste numa VM descartável com snapshot. A alpha.27 falhou na role Steam após o primeiro update do canal Nix ter falhado com certificado TLS ainda não válido. O relógio da VM foi corrigido pelo usuário; ainda falta validar o retry no Alpine real. Não repetir Apply total na alpha.27 se o sistema manteve alterações parciais; usar Check status e a alpha.28 após CI verde.

## 0.1.0-alpha.27-web — candidata para teste de VM

- Corrige o erro de Apply observado na VM: o Makefile não passa mais `ansible-playbook` como argumento extra ao wrapper autorizado. O teste de regressão agora verifica a linha de comando de `make -n` nos quatro alvos privilegiados.
- Na tela de módulo, mostra os checks individuais, o status e a mensagem de cada componente, incluindo erros/avisos de pacotes ou configurações ausentes. **Apply all modules** fica disponível tanto em Modules quanto em Configuration e mantém confirmação explícita.
- Cada operação mantém log privado em `operations/general/` ou, para check/apply de um módulo, em `operations/modules/<module>/`; a interface mostra o caminho persistido.
- Corrige a cascata do modo claro carregando a folha de acessibilidade depois do tema compacto: textos auxiliares passam a ter no mínimo 11–12 px, tons de primeiro plano mais escuros e estados desabilitados legíveis.
- Mantém `doas` autenticado no terminal do sistema. A senha não foi removida nem enviada ao browser; não foi introduzida regra `nopass`. Uma integração gráfica sem terminal exigiria helper root-owned e ação Polkit restrita, ainda não implementados.
- Atualiza o pin de `v1.44-dev` para o commit `881558709d94539acc81bd06ef556ba3562dc07d`.

Alpha para validação em Alpine 3.24.3/KDE numa VM descartável com snapshot; ainda não é estável. Testes automatizados locais e CI não substituem a nova prova de integração na VM.

## 0.1.0-alpha.26-web — build local de UX, não publicada

- Corrige o ponteiro de espera enganoso: ações bloqueadas mostram `not-allowed`; durante uma operação, o cursor permanece normal e o spinner/cartão indicam atividade.
- O Apply desabilitado no tema claro usa fundo neutro e texto legível; as variáveis de texto secundário foram corrigidas no CSS base, que antes sobrepunha os valores de contraste.
- A tela de operação de módulo agora orienta a verificar o terminal separado e abrir **Show logs** se a execução parecer parada, sem repetir a operação.
- Mantém o backend `v1.44-dev` fixado no commit de segurança `e07a1221c310a19a8c5450217476c8e3da105b8d`.

Build destinada a verificar na VM os dois sintomas reportados. A alpha.26 não foi testada em Alpine real nem publicada; Apply e compatibilidade de terminal continuam bloqueados até esse teste.

## 0.1.0-alpha.25-web — candidata local para teste, não publicada

- Substitui o backend v1.43 pelo branch de correção `v1.44-dev`, fixado no commit `e07a1221c310a19a8c5450217476c8e3da105b8d`.
- O executor privilegiado faz uma única transição `doas -u root` no terminal visível, não cria regra `nopass`, remove as duas regras amplas conhecidas de versões anteriores antes de chamar Ansible e aborta se a limpeza falhar. O Ansible usa `su` para as transições internas.
- Adiciona teste de regressão e CI do backend para sintaxe shell e para impedir a reintrodução do modelo `nopass`; o CI do frontend valida pin, manifesto e dois builds determinísticos.
- A licença MIT foi adicionada aos repositórios frontend e backend e é incluída no tarball portátil.

A correção de código e os testes automatizados **não substituem** validação numa VM Alpine real. A alpha.24 permanece retirada: seu artefato incorporava o backend v1.43 e sua tag pública foi removida. A alpha.25 é somente para VM descartável com snapshot; o fluxo de `doas`, a troca `su`, falhas/cancelamentos e os terminais suportados ainda precisam ser testados antes de qualquer publicação pública.

## 0.1.0-alpha.24-web — candidata de teste, retirada

- Removido o endpoint de texto livre para entrada no PTY do browser. Apply exige confirmação e autenticação ocorre em terminal externo; refresh de apps Nix e migração Stable também usam esse caminho. O token é gerado por lançamento, gravado atomicamente em arquivo privado e entregue à UI apenas por cookie `HttpOnly; SameSite=Strict`.
- O bridge é loopback-only, verifica endereço remoto e Host/Origin estritos, recusa bind fora de `127.0.0.1`, rejeita manifestos inválidos/symlinks e só aceita metadata de diagnóstico schema 1. O launcher e o servidor usam locks para evitar inicializações concorrentes.
- Apply de módulo exige diagnóstico recente para o módulo, lista de dependências coerente com o catálogo e diagnósticos `complete` recentes para cada dependência, no cliente e no servidor. Warnings deixam de aparecer como sucesso sem ressalvas; resultados JSON, catálogo e estados têm validação runtime.
- Migração Nix Stable exige relatório oficial, coerente e recente (`update_available`) tanto na UI quanto no bridge; checks expirados, falhos, inválidos e mutações anteriores não autorizam migração. Validate again atualiza health e catálogo após reparo bem-sucedido.
- A prévia `make simular` bloqueia sem dependências/estado Ansible já preparado e não instala pré-requisitos automaticamente. Continua best-effort: o check mode pode ignorar tarefas e não substitui revisão de efeitos.
- PTY tem limites de output, timeout, rastreamento de descendentes e hard stop; o bridge bloqueia retries quando detecta PID residual. Logs têm retenção limitada e os temporários do terminal são limpos nos caminhos tratados.
- O backend incluído era read-only por padrão. O empacotador exigia frontend limpo, lockfile congelado, versão consistente, backend Git verificável e SHA imutável do v1.43 (sem override); validava o pacote antes de criar tarball determinístico.
- A suíte do bridge cobre manifestos, cookies, locks, loopback, schema, diagnóstico/dependências, prévia bloqueada, logs, allowlist e timeouts, incluindo descendente detached via `setsid`.

Esta candidata foi retirada porque o backend v1.43 ainda instalava uma regra ampla `doas nopass` que podia persistir após encerramento abrupto. Não usar em máquina de produção.

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
