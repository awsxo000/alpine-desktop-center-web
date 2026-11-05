# Alpine Desktop Center Web — alpha.29

A alpha.29 é candidata comunitária para teste em Alpine 3.24.3/KDE; não é stable. Backend embutido: `v1.44-dev`, commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada.

## Correções desta candidata

- A saída do terminal privilegiado é lida incrementalmente e aparece em **Show logs** enquanto a execução está ativa; o log privado também é gravado durante o progresso. Prompts `doas` continuam somente no terminal do sistema.
- A aba Modules separa lista de módulos e detalhe/checks, confinando rolagens às áreas internas. Em telas estreitas, os painéis se empilham; a rolagem da lista/checks continua limitada.
- O backend tenta atualizar o canal Nix se a URL está configurada mas o conteúdo local não foi baixado, evitando o erro posterior `attribute 'nixpkgs' not found` observado após uma falha TLS.

## Execução alpha.28 na VM

A alpha.28 não transmite output durante o comando. O log temporário daquela operação ficava em `.alpine-state/web/0.1.0-alpha.28-web/operations/20261105T185708Z-530f2256.terminal-output`, a partir da raiz da release. O timeout de segurança é 15 minutos e já pode ter sido atingido; o fluxo de timeout limpa esse temporário. Confira o log persistente `.alpine-state/web/0.1.0-alpha.28-web/operations/general/20261105T185708Z-530f2256.log` primeiro. Não repita o Apply sem examinar o resultado. Se não houver pre-Apply snapshot de hipervisor, não tente desfazer por remoção manual de pacotes; faça **Check status**, preserve os logs e avalie o estado real.

## Undo/rollback

A auditoria das 11 roles (base, Nix, Steam, Nix OpenGL, rede, Bluetooth, áudio, swap, energia, fontes e KDE) concluiu que todas têm somente reversibilidade parcial: nenhuma registra um baseline abrangente ou implementa rollback completo. Todas podem deixar alterações de pacotes/configuração/serviço; rede pode interromper conexão e swap/hibernação pode comprometer boot/retomada. KDE mantém um `.alpine-desktop.orig` em certas condições, mas não integra restauração automatizada.

Por segurança, a alpha.29 não oferece “desfazer” automático para aplicações anteriores sem snapshot. Não converter desmarcação de módulo em desinstalação. Implementar Undo requer snapshot pré-Apply por execução, inventários pré/pós, preservação de bytes e metadados, checagem de drift, remoção apenas do que foi comprovadamente introduzido, preview e confirmação. Pacotes compartilhados, dados externos e Nix store não devem ser removidos por inferência; swap e GRUB exigem fluxo especializado.

## Próximas validações

- [ ] Capturar o resultado da execução alpha.28 e registrar o log privado, sem credenciais.
- [ ] Instalar a alpha.29 em VM descartável criada de snapshot; testar saída live durante `Apply all modules` e `Apply module`.
- [ ] Testar `Check status`, retry do canal Nix após cache ausente, e estado Steam sem `nixpkgs.steam not found`.
- [ ] Confirmar layout em 1366×768 e resolução menor; testar rolagem interna da lista/checks sem invasão da página.
- [ ] Validar tema claro/escuro e terminais Konsole, xterm e XFCE Terminal.
- [ ] Revisar logs geral/por módulo, interrupção/timeout, processos órfãos e ausência de regras amplas `doas nopass`.
- [ ] Antes de stable, entregar Undo baseado em snapshots e dry-run/diff por role; testar em VM e documentar.

Não usar em produção. Não digitar credenciais na UI, não desativar TLS e não afirmar rollback de estado que nunca foi registrado.
