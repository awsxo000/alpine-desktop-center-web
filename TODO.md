# Alpine Desktop Center Web — alpha.62

A alpha.37 é uma pré-release comunitária para validação em Alpine 3.24.3/KDE, não stable. Backend embutido: `v1.44-dev`, commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada. Testes automatizados e prévia sandbox não substituem aplicação real em VM.

## Mudanças desta candidata

- **Arquitetura da informação:** consolida a navegação em cinco destinos — **Início, Verificar, Aplicar, Nix e Histórico** — preservando as operações existentes.
- **Nix e Histórico:** Nix reúne canal Stable, atualização do perfil de aplicativos, refresh separado do menu KDE com reinício do Plasma e migração condicionada a uma verificação oficial recente; Histórico passa a reunir contagens da sessão, operações e logs persistentes numa única fonte.
- **Refresh Nix no KDE:** diferencia a ação que reconstrói o menu e reinicia o shell Plasma sem atualizar pacotes da ação **Atualizar aplicativos Nix**, que altera o perfil do usuário; ambas exibem confirmação e cópia localizada.
- **Localização:** amplia o PT-BR para títulos, ações, instruções técnicas e estados; mantém os seletores concisos **BR/US** com nomes acessíveis.
- **Densidade desktop:** remove o chip lateral repetitivo e uma etapa duplicada do resumo inicial, aproveita a largura disponível e evita rolagem global nas resoluções verificadas.
- **Logs por ação:** organiza os novos registros em `.alpine-state/web/<versão>/logs/verify/`, `apply/` e `nix/`, com subpastas por tipo de operação e módulo; o Histórico mostra o destino e continua lendo os caminhos legados `operations/general/` e `operations/modules/`.
- **Verificação em dois fatores:** para cada módulo, distingue o estado atual do sistema (pacotes, serviços e configurações que já estão presentes) da prontidão para aplicar (diagnóstico recente, dependências declaradas verificadas e arquivos do backend embarcado validados pelo manifesto SHA-256). Um módulo incompleto pode estar pronto para receber a instalação.
- **Integridade:** o painel descreve a integridade do backend da versão e distingue falha de conexão sem afirmar falsamente que o bloqueio está ativo.

- **Abertura em tela cheia:** Chromium, Chromium Browser e Google Chrome abrem o app local em fullscreen; Firefox continua usando kiosk. O launcher mantém o perfil local e o bridge loopback.
- **Idioma:** o controle compacto do cabeçalho exibe somente **BR** e **US**, preserva os locales `pt-BR`/`en-US`, o rótulo acessível e a preferência local entre sessões.
- **Início e objetivo:** a página inicial explica que a ferramenta configura um Alpine Linux já instalado, combina a base Stable com aplicativos Nix e módulos de desktop como áudio, Bluetooth, NetworkManager e KDE, e não instala o sistema operacional.
- **Identidade visual:** nova marca vetorial de montanhas Alpine e ponto central, na paleta azul/verde do projeto, compartilhada pelo app, favicon e launcher do desktop.
- **Layout responsivo:** a área principal aproveita a viewport larga; em telas com pouca altura ou zoom elevado, os painéis internos podem rolar sem cortar conteúdo nem rolar a página inteira. O destaque inicial distribui a explicação em duas colunas no desktop.
- **Ações:** hover de Apply module, Apply all e migração Stable mantém o azul de assinatura e usa elevação/sombra discretas; foco por teclado permanece claramente visível.
- **Integridade e auditoria da alpha.33:** refresh de integridade real, check do canal Stable persistente, operações nomeadas, logs locais por versão e módulos/diagnósticos em painéis confinados permanecem inalterados.
- Alpha 56 inicia a migração para Polkit, corrige o duplo clique e elimina o falso timeout do bridge: operações do perfil Nix não abrem mais terminal externo, o desktop entry portátil usa um `Exec` aceito pelo parser KDE/GLib e o health check reutiliza a validação de manifesto já concluída no startup. Apply de sistema e migração Stable ainda usam `doas` no terminal até a entrega do helper root-owned com ações Polkit restritas. Undo automático não está implementado por falta de snapshot/baseline verificável.

## Incidente anterior na VM

A alpha.28 falhou na role Steam porque `nixpkgs.steam` não estava disponível depois de um erro anterior na atualização do canal Nix. O arquivo temporário dessa execução pode ter sido removido pelo timeout. Consulte primeiro o log persistente da própria versão; não repita Apply nem remova pacotes por inferência. Faça snapshot de uma VM limpa antes de qualquer novo Apply total.

## Próximas validações na VM

- [ ] Baixar e extrair a alpha.37 em VM descartável com snapshot; confirmar versão e `RELEASE-VERSIONS` antes de executar.
- [ ] Confirmar no ambiente desktop real que Chromium/Chrome abre em tela cheia, que Firefox permanece em kiosk, que o launcher mostra a nova logo e que a janela pode ser encerrada sem matar o bridge inesperadamente.
- [ ] Conferir **BR** seleciona Português brasileiro e **US** seleciona English (United States), incluindo rótulos acessíveis, teclado, preferência salva e restauração após fechar/reabrir.
- [ ] Conferir em tema claro/escuro e em 1366×768/resolução menor que a página Início explica o escopo correto, que a marca permanece nítida, que a largura é aproveitada e que scroll interno não corta cards em 100%/150% de zoom.
- [ ] Conferir hover, pressed e foco por teclado nos botões Apply module, Apply all e Migrate Stable; verificar que o azul não muda para um tom excessivamente escuro.
- [ ] Em instalação limpa, confirmar **Stable channel — Not checked**; acionar a verificação Stable, conferir resultado e caminho em `logs/nix/stable-check/`, fechar/reabrir o app e confirmar persistência.
- [ ] Acionar atualização de integridade do backend e confirmar resposta ao vivo, catálogo e estado validado. Não alterar nem apagar arquivos da release durante esse teste.
- [ ] Executar check de um módulo e check de todos; conferir componentes PASS/MISSING/WARN, status por módulo, caminhos em `logs/verify/modules/<module>/` e `logs/verify/all-modules/`, e abertura dos logs em Verificar e Histórico.
- [ ] Confirmar que Verificar concentra diagnósticos somente para leitura; Aplicar oferece aplicação individual, prévia e aplicação completa, com diagnóstico/dependências recentes exigidos para a ação individual.
- [ ] Em cada módulo, conferir que **Estado atual do sistema** descreve componentes instalados/configurados e que **Prontidão para instalar** reporta separadamente diagnóstico recente, dependências completas e integridade SHA-256 do backend; confirmar que componente ausente no módulo-alvo não bloqueia sua própria instalação quando os pré-requisitos estão satisfeitos.
- [ ] Confirmar que Nix oferece somente Stable, separa atualização do perfil de usuário do refresh do menu KDE/Plasma, e não habilita migração por status salvo: exige check oficial recente nesta instância e update disponível.
- [ ] Em VM de teste, confirmar que **Atualizar aplicativos Nix** atualiza o perfil do usuário e que **Recarregar apps Nix no KDE** reconstrói o menu e reinicia o Plasma sem atualizar pacotes nem alterar o perfil; conferir as confirmações distintas e os registros no Histórico.
- [ ] Conferir Histórico com operações da sessão, contadores, histórico persistente, atualização e abertura de logs privados.
- [ ] Conferir que cada ação grava na pasta específica `verify`, `apply` ou `nix`, que os caminhos aparecem no Histórico, e que logs antigos em `operations/general/` e `operations/modules/` seguem acessíveis.
- [ ] Revalidar retry de canal Nix/caso Steam, saída de execução ao vivo, autorização `doas` one-shot e ausência de regra `nopass`; conferir Konsole/xterm/XFCE Terminal, cancelamento e timeout.
- [ ] Não afirmar sucesso de operação que não terminou. Salvar os logs e snapshot antes de qualquer tentativa de repetição ou restauração manual.

## Undo/rollback

A auditoria das 11 roles (base, Nix, Steam, Nix OpenGL, rede, Bluetooth, áudio, swap, energia, fontes e KDE) concluiu que todas têm somente reversibilidade parcial; nenhuma registra baseline abrangente nem implementa rollback completo. Não converter desmarcação de módulo em desinstalação. Undo futuro requer snapshot pré-Apply, inventário pré/pós, preservação de bytes/metadados, checagem de drift, remoção somente do que foi comprovadamente introduzido, preview e confirmação. Pacotes compartilhados, dados externos e Nix store não devem ser removidos por inferência; swap e GRUB exigem fluxo especializado.

**Não usar em produção.** Não digitar credenciais na UI, não desativar TLS e não inferir rollback sem snapshot conhecido.
