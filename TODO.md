# Alpine Desktop Center Web — alpha.33

A alpha.33 é uma pré-release comunitária para validação em Alpine 3.24.3/KDE, não stable. Backend embutido: `v1.44-dev`, commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada. Testes automatizados e prévia sandbox não substituem aplicação real em VM.

## Mudanças desta candidata

- **Abertura em tela cheia:** Chromium, Chromium Browser e Google Chrome abrem o app local em fullscreen; Firefox continua usando kiosk. O launcher mantém o perfil local e o bridge loopback.
- **Idioma:** o controle compacto do cabeçalho exibe somente **BR** e **US**, preserva os locales `pt-BR`/`en-US`, o rótulo acessível e a preferência local entre sessões.
- **Welcome e objetivo:** a página inicial explica que a ferramenta configura um Alpine Linux já instalado, combina a base Stable com aplicativos Nix e módulos de desktop como áudio, Bluetooth, NetworkManager e KDE, e não instala o sistema operacional.
- **Identidade visual:** nova marca vetorial de montanhas Alpine e ponto central, na paleta azul/verde do projeto, compartilhada pelo app, favicon e launcher do desktop.
- **Layout responsivo:** a área principal aproveita a viewport larga; em telas com pouca altura ou zoom elevado, os painéis internos podem rolar sem cortar conteúdo nem rolar a página inteira. O destaque inicial distribui a explicação em duas colunas no desktop.
- **Ações:** hover de Apply module, Apply all e migração Stable mantém o azul de assinatura e usa elevação/sombra discretas; foco por teclado permanece claramente visível.
- **Integridade e auditoria da alpha.32:** refresh de integridade real, check do canal Stable persistente, operações nomeadas, logs locais por versão e módulos/diagnósticos em painéis confinados permanecem inalterados.
- Mantém `doas` autenticado no terminal do sistema; não cria regra `nopass`. Undo automático não está implementado por falta de snapshot/baseline verificável.

## Incidente anterior na VM

A alpha.28 falhou na role Steam porque `nixpkgs.steam` não estava disponível depois de um erro anterior na atualização do canal Nix. O arquivo temporário dessa execução pode ter sido removido pelo timeout. Consulte primeiro o log persistente da própria versão; não repita Apply nem remova pacotes por inferência. Faça snapshot de uma VM limpa antes de qualquer novo Apply total.

## Próximas validações na VM

- [ ] Baixar e extrair a alpha.33 em VM descartável com snapshot; confirmar versão e `RELEASE-VERSIONS` antes de executar.
- [ ] Confirmar no ambiente desktop real que Chromium/Chrome abre em tela cheia, que Firefox permanece em kiosk, que o launcher mostra a nova logo e que a janela pode ser encerrada sem matar o bridge inesperadamente.
- [ ] Conferir **BR** seleciona Português brasileiro e **US** seleciona English (United States), incluindo rótulos acessíveis, teclado, preferência salva e restauração após fechar/reabrir.
- [ ] Conferir em tema claro/escuro e em 1366×768/resolução menor que o Welcome explica o escopo correto, que a marca permanece nítida, que a largura é aproveitada e que scroll interno não corta cards em 100%/150% de zoom.
- [ ] Conferir hover, pressed e foco por teclado nos botões Apply module, Apply all e Migrate Stable; verificar que o azul não muda para um tom excessivamente escuro.
- [ ] Em instalação limpa, confirmar **Stable channel — Not checked**; acionar o refresh, conferir resultado e caminho no log geral, fechar/reabrir o app e confirmar persistência.
- [ ] Acionar atualização de integridade do backend e confirmar resposta ao vivo, catálogo e estado validado. Não alterar nem apagar arquivos da release durante esse teste.
- [ ] Executar check de um módulo e check de todos; conferir componentes PASS/MISSING/WARN, status por módulo, log geral, caminho e abertura do log em System Check e Summary.
- [ ] Confirmar que a tela Modules não contém botões de check, que Apply individual exige diagnóstico/dependências recentes e que Apply all modules aparece somente ali.
- [ ] Confirmar que Configuration não oferece canal Unstable e que um status Stable salvo, sozinho, não habilita migração: ela requer check oficial recente nesta instância e update disponível.
- [ ] Conferir Summary com operações registradas na execução, contadores, refresh do histórico e abertura de logs privados.
- [ ] Revalidar retry de canal Nix/caso Steam, saída de execução ao vivo, autorização `doas` one-shot e ausência de regra `nopass`; conferir Konsole/xterm/XFCE Terminal, cancelamento e timeout.
- [ ] Não afirmar sucesso de operação que não terminou. Salvar os logs e snapshot antes de qualquer tentativa de repetição ou restauração manual.

## Undo/rollback

A auditoria das 11 roles (base, Nix, Steam, Nix OpenGL, rede, Bluetooth, áudio, swap, energia, fontes e KDE) concluiu que todas têm somente reversibilidade parcial; nenhuma registra baseline abrangente nem implementa rollback completo. Não converter desmarcação de módulo em desinstalação. Undo futuro requer snapshot pré-Apply, inventário pré/pós, preservação de bytes/metadados, checagem de drift, remoção somente do que foi comprovadamente introduzido, preview e confirmação. Pacotes compartilhados, dados externos e Nix store não devem ser removidos por inferência; swap e GRUB exigem fluxo especializado.

**Não usar em produção.** Não digitar credenciais na UI, não desativar TLS e não inferir rollback sem snapshot conhecido.
