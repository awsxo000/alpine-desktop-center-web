# Plano de implementação — Alpine Desktop Center Web

## Objetivo

Fortalecer a versão web local sem alterar a ideia original: o usuário baixa a release, abre com dois cliques, verifica o backend embutido e executa apenas operações nomeadas do backend Ansible. As ações de módulos continuam independentes, como no Qt legado.

## Entregas desta rodada

1. **Ponte local segura**: token aleatório por sessão, validação de Host/Origin, Content-Type estrito, respostas JSON para APIs desconhecidas e bloqueio server-side contra operações concorrentes.
2. **Execução resiliente**: grupos de processos para timeout/cancelamento futuro, mensagens de estado distintas para bloqueio de integridade e falha de execução, e logs versionados dentro da release.
3. **Estado real**: endpoints locais para health, módulos e histórico de operações; a interface deixa de tratar integridade e módulos fixos como fatos atuais.
4. **Launcher confiável**: aguardar `/api/health` antes de abrir a janela dedicada e entregar o token por URL local de sessão.
5. **Transparência**: operação, logs, integridade e módulos alimentam a interface; ações destrutivas terão confirmação explícita na camada seguinte.

## Arquitetura

- `server/local_server.py`: servidor loopback, autenticação da sessão, allowlist de operações, validação SHA-256, execução protegida e endpoints de estado/histórico.
- `Alpine Desktop Center`: launcher de dois cliques, escolha de porta, token de sessão, espera de health e abertura da janela app.
- `src/api.ts`: cliente HTTP local com token e contratos de estado.
- `src/types.ts`: tipos de backend, módulos, logs e operações.
- `src/App.tsx`: apresentação, seleção independente de módulos e consumo do estado real.
- `.alpine-state/web/<frontend-version>/`: logs e estado operacional versionados por release.

## Direção visual e interação

A identidade continua baseada na paleta Rokko, com organização inspirada em Agama/openSUSE apenas como referência estrutural. A navegação entre seções permanece livre; nenhuma etapa futura será bloqueada. Check status é somente leitura e Apply é uma ação separada.

## Limites preservados

O navegador nunca envia shell arbitrário; somente operações da allowlist. O backend embutido continua sendo a fonte de verdade e deve passar pela validação SHA-256 antes de qualquer execução. Canais Unstable do Nix não serão expostos. A senha do doas não será coletada nem persistida pela aplicação web.
