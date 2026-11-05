# Alpine Desktop Center Web — alpha.32

A alpha.32 é uma pré-release comunitária para validação em Alpine 3.24.3/KDE, não stable. Backend embutido: `v1.44-dev`, commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada. Os testes automatizados e a prévia sandbox não substituem aplicação real em VM.

## Mudanças desta candidata

- **Welcome:** o refresh de integridade chama o backend de verdade, revalida os arquivos via manifesto e recarrega catálogo/health. O check do canal oficial Stable cria log próprio; o último resultado é reexibido após reiniciar. Em instalação limpa, sem histórico, o status aparece como **Not checked**.
- **System Check:** centraliza check individual e de todos os módulos, resultado de componentes, registro da última aplicação por módulo e histórico de operações/logs.
- **Modules:** fica somente para aplicação individual ou Apply all. **Configuration** exibe a política Stable, sem switch Unstable nem Apply all.
- **Summary:** exibe relatório da sessão e lista de logs persistidos com acesso ao arquivo de cada operação.
- **Tema/layout:** corrige contrastes em dark mode e reduz espaço ocioso no painel Modules; lista, detalhes, componentes, terminal e Session Audit mantêm áreas limitadas de rolagem.
- **Logs:** são locais, privados e separados por versão. Checks Stable/gerais: `.alpine-state/web/<frontend-version>/operations/general/<id>.log`; operação individual: `.alpine-state/web/<frontend-version>/operations/modules/<module>/<id>.log`.
- Mantém o fluxo `doas` autenticado no terminal do sistema; não cria regra `nopass`. Undo automático não está implementado por falta de snapshot/baseline verificável.

## Incidente anterior na VM

A alpha.28 falhou na role Steam porque `nixpkgs.steam` não estava disponível depois de um erro anterior na atualização do canal Nix. O arquivo temporário dessa execução pode ter sido removido pelo timeout. Consulte primeiro o log persistente da própria versão; não repita Apply nem remova pacotes por inferência. Faça snapshot de uma VM limpa antes de qualquer novo Apply total.

## Próximas validações na VM

- [ ] Baixar e extrair a alpha.32 em VM descartável com snapshot; confirmar versão e `RELEASE-VERSIONS` antes de executar.
- [ ] Em instalação limpa, confirmar **Stable channel — Not checked**; acionar o refresh, conferir resultado e caminho no log geral, fechar/reabrir o app e confirmar persistência.
- [ ] Acionar atualização de integridade do backend e confirmar resposta ao vivo, catálogo e estado validado. Não alterar nem apagar arquivos da release durante este teste.
- [ ] Executar check de um módulo e check de todos; conferir componentes PASS/MISSING/WARN, status por módulo, log geral, caminho e abertura do log em System Check e Summary.
- [ ] Confirmar que a tela Modules não contém botões de check, que Apply individual exige diagnóstico/dependências recentes e que Apply all modules aparece somente ali.
- [ ] Confirmar que Configuration não oferece canal Unstable e que um status Stable salvo, sozinho, não habilita migração: ela requer check official recente nesta instância e update disponível.
- [ ] Conferir Summary com operações registradas na execução, contadores, refresh do histórico e abertura de logs privados.
- [ ] Conferir dark/light, header/bridge status, Configuration, hover/foco e contraste em 1366×768 e resolução menor; confirmar que Modules/System Check/logs rolam dentro de seus painéis e não atravessam cards.
- [ ] Revalidar retry de canal Nix/caso Steam, saída de execução ao vivo, autorização `doas` one-shot e ausência de regra `nopass`; conferir Konsole/xterm/XFCE Terminal, cancelamento e timeout.
- [ ] Não afirmar sucesso de operação que não terminou. Salvar os logs e snapshot antes de qualquer tentativa de repetição ou restauração manual.

## Undo/rollback

A auditoria das 11 roles (base, Nix, Steam, Nix OpenGL, rede, Bluetooth, áudio, swap, energia, fontes e KDE) concluiu que todas têm somente reversibilidade parcial; nenhuma registra baseline abrangente nem implementa rollback completo. Não converter desmarcação de módulo em desinstalação. Undo futuro requer snapshot pré-Apply, inventário pré/pós, preservação de bytes/metadados, checagem de drift, remoção somente do que foi comprovadamente introduzido, preview e confirmação. Pacotes compartilhados, dados externos e Nix store não devem ser removidos por inferência; swap e GRUB exigem fluxo especializado.

**Não usar em produção.** Não digitar credenciais na UI, não desativar TLS e não inferir rollback sem snapshot conhecido.
