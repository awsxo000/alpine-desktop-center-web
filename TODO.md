# Alpine Desktop Center Web — alpha.30

A alpha.30 é uma candidata comunitária para teste em Alpine 3.24.3/KDE, não stable. Backend embutido: `v1.44-dev`, commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada.

## Ajustes desta candidata

- **Session Audit:** até 100 eventos recentes ficam numa lista com altura máxima e rolagem interna; mensagens longas quebram linha, sem empurrar ou sobrepor cartões adjacentes. **Show logs** continua abrindo o histórico completo.
- **Modules:** lista compacta por nome, ícone Lucide específico à função e indicador de estado acessível; descrições ficam no detalhe selecionado. O cartão Selected Module ocupa a altura disponível, apresenta estado, descrição, dependências, bloqueios e ações alinhadas na base; a orientação “Need to understand a step?” fica logo abaixo.
- **Hover/foco:** hover diferenciado para botões de ação e de módulo, com cores distintas no tema claro/escuro; controles desabilitados não recebem estilo de hover interativo.
- Preserva streaming da saída do terminal e confinamento de rolagem em lista/checks. O fluxo de senha doas continua no terminal externo.

## Execução alpha.28 na VM

A alpha.28 não transmitia output durante o comando. O arquivo temporário da operação (`.alpine-state/web/0.1.0-alpha.28-web/operations/20261105T185708Z-530f2256.terminal-output`) pode ter sido limpo pelo timeout de segurança de 15 minutos. Confira primeiro o log persistente `.alpine-state/web/0.1.0-alpha.28-web/operations/general/20261105T185708Z-530f2256.log`. Não repita Apply sem examinar o resultado. Se não houver snapshot pré-Apply do hipervisor, não tente desfazer por remoção manual de pacotes; faça **Check status**, preserve os logs e avalie o estado real.

## Undo/rollback

A auditoria das 11 roles (base, Nix, Steam, Nix OpenGL, rede, Bluetooth, áudio, swap, energia, fontes e KDE) concluiu que todas têm somente reversibilidade parcial: nenhuma registra baseline abrangente ou implementa rollback completo. Todas podem deixar alterações de pacotes/configuração/serviço; rede pode interromper conexão e swap/hibernação pode comprometer boot/retomada. KDE mantém `.alpine-desktop.orig` em certas condições, mas não integra restauração automatizada.

Por segurança, a alpha.30 não oferece “desfazer” automático para aplicações anteriores sem snapshot. Não converter desmarcação de módulo em desinstalação. Implementar Undo requer snapshot pré-Apply por execução, inventários pré/pós, preservação de bytes/metadados, checagem de drift, remoção apenas do que foi comprovadamente introduzido, preview e confirmação. Pacotes compartilhados, dados externos e Nix store não devem ser removidos por inferência; swap e GRUB exigem fluxo especializado.

## Próximas validações

- [ ] Instalar alpha.30 em VM descartável criada de snapshot; testar streaming durante `Apply all modules` e `Apply module`.
- [ ] Testar `Check status`, retry do canal Nix quando cache ausente e estado Steam sem `nixpkgs.steam not found`.
- [ ] Confirmar Session Audit com mensagens numerosas/longas, rolagem interna e nenhum conteúdo por cima dos cartões vizinhos.
- [ ] Confirmar layout em 1366×768 e resolução menor; verificar nomes/ícones, painel selecionado, estados hover/foco claro/escuro e rolagens internas.
- [ ] Validar terminais Konsole, xterm e XFCE Terminal, interrupção/timeout, processos órfãos, logs geral/por módulo e ausência de regras amplas `doas nopass`.
- [ ] Antes de stable, entregar Undo baseado em snapshots e dry-run/diff por role; validar em VM e documentar.

Não usar em produção. Não digitar credenciais na UI, não desativar TLS e não afirmar rollback de estado que nunca foi registrado.
