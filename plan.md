# Plano de implementação — Alpine Desktop Center Web

## Objetivo

Fortalecer a versão web local sem alterar a ideia original: o usuário baixa a release, abre com dois cliques, verifica o backend embutido e executa somente operações nomeadas do backend Ansible. O Alpine Desktop Center é um configurador pós-instalação: usa Alpine Linux Stable como base, administra aplicativos Nix no perfil do usuário e orienta a configuração de módulos de desktop como áudio, Bluetooth, NetworkManager e KDE. Não instala o sistema operacional. As ações de módulos continuam independentes, como no Qt legado.

## Entregas desta linha

1. **Ponte local segura**: token aleatório por sessão, validação de Host/Origin, Content-Type estrito, respostas JSON para APIs desconhecidas e bloqueio server-side contra operações concorrentes.
2. **Execução resiliente**: grupos de processos para timeout/cancelamento, mensagens distintas para bloqueio de integridade e falha, logs versionados dentro da release e autenticação `doas` no terminal do sistema.
3. **Estado real**: endpoints locais para health, módulos e histórico de operações; a interface não trata integridade nem módulos fixos como fatos atuais.
4. **Launcher confiável**: aguarda `/api/health` antes de abrir a janela dedicada e entrega o token por cookie local; Chromium/Chrome abrem em fullscreen app mode e Firefox permanece em kiosk.
5. **Transparência**: operação, logs, integridade e módulos alimentam a interface; ações destrutivas exigem confirmação explícita.
6. **Apresentação alpha.33**: Welcome explica com clareza o objetivo pós-instalação, a seleção de idioma fica compacta BR/US, os painéis aproveitam a viewport e mantêm rolagem interna em telas curtas, e as ações principais usam hover/foco discretos e acessíveis.

## Arquitetura

- `server/local_server.py`: servidor loopback, autenticação da sessão, allowlist de operações, validação SHA-256, execução protegida e endpoints de estado/histórico.
- `Alpine Desktop Center`: launcher de dois cliques, escolha de porta, token de sessão, espera de health e janela de navegador em tela cheia.
- `src/api.ts`: cliente HTTP local com sessão e contratos de estado.
- `src/types.ts`: tipos de backend, módulos, logs e operações.
- `src/i18n.ts`: cópias de português brasileiro e inglês dos Estados Unidos.
- `src/App.tsx`: apresentação, tela inicial, navegação independente de módulos e consumo do estado real.
- `src/workspace-enhancements.css`: densidade e rolagem responsiva, seletor de idioma, marca, acessibilidade de ações e estados de interação.
- `.alpine-state/web/<frontend-version>/`: logs e estado operacional versionados por release.

## Direção visual e interação

A identidade permanece baseada na paleta Rokko, agora com uma marca vetorial simples de montanhas Alpine e ponto central. Agama/openSUSE é somente referência estrutural. A navegação entre seções permanece livre; nenhuma etapa futura é bloqueada. Check status é somente leitura e Apply é uma ação separada. Os botões principais preservam a cor institucional no hover; uma elevação leve, contorno e foco visível indicam interação sem alteração agressiva de cor.

## Limites preservados

O navegador nunca envia shell arbitrário; somente operações da allowlist. O backend embutido continua sendo a fonte de verdade e deve passar pela validação SHA-256 antes de qualquer execução. Canais Unstable do Nix não são expostos. A senha do `doas` não é coletada nem persistida pela aplicação web. A validação real de mudanças privilegiadas exige VM Alpine descartável com snapshot; builds e testes automatizados não a substituem.
