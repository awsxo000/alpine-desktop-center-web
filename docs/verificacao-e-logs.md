# Verificações do sistema e histórico de logs

Este guia descreve a organização da pré-release `0.1.0-alpha.37-web`. Ela continua sendo uma versão alpha e ainda requer validação operacional em Alpine Linux real.

## Início: integridade e canal Stable

A página **Início** começa sem resultado salvo do canal: uma instalação limpa mostra **Não verificado**. Não há log Stable incluído no pacote. Ao atualizar o **Canal Stable**, a aplicação consulta a fonte oficial, salva a saída e mantém o último resultado depois de reiniciar.

A ação **Verificar novamente** na página **Verificar** valida os arquivos embutidos pelo manifesto SHA-256 e atualiza o catálogo de módulos. Se algum arquivo estiver alterado ou ausente, a resposta indica falha ou bloqueio em vez de manter um estado validado desatualizado. Essa verificação é somente para leitura.

## Verificar e Aplicar

**Verificar** concentra diagnósticos sem aplicar mudanças. É possível verificar um módulo por vez ou todos. Os resultados incluem status, horário, componentes aprovados/faltantes e avisos/erros. A página mostra o histórico recente e permite abrir os logs associados.

Para cada módulo, a aplicação separa dois fatores que respondem a perguntas diferentes:

1. **Estado atual do sistema:** o diagnóstico somente para leitura consulta os pacotes, serviços, processos, arquivos de configuração e recursos pertinentes ao módulo. Esse resultado informa o que já existe no Alpine instalado; componentes ausentes podem ser justamente o que o Apply deverá configurar.
2. **Prontidão para instalar/aplicar:** o painel Aplicar só mostra “Pronto para aplicar” quando há um diagnóstico recente do módulo, todos os módulos declarados como dependências têm diagnóstico recente e completo, o catálogo de dependências corresponde ao diagnóstico e os arquivos do backend embarcado passam pela validação SHA-256 da release. Se algum requisito faltar, o painel apresenta o bloqueio correspondente.

Assim, um módulo pode aparecer como parcial/incompleto no estado atual e ainda estar pronto para instalação. Os dois resultados não devem ser confundidos: a prontidão não exige que o próprio módulo já esteja instalado. A integridade SHA-256 cobre os arquivos do backend embarcado e do catálogo/roles usados para aplicar as configurações; não é uma verificação individual de cada arquivo do sistema Alpine.

**Aplicar** é dedicado às mudanças: aplicar um módulo ou a configuração completa, além de pré-visualizar a configuração quando os pré-requisitos locais já existem. A aplicação individual permanece bloqueada até haver diagnóstico válido recente e dependências completas. A ação completa e a prévia exigem confirmação explícita.

## Nix

**Nix** agrupa as ações do canal oficial Stable e duas ações diferentes para aplicativos: **Atualizar aplicativos Nix** atualiza pacotes no perfil do usuário; **Recarregar apps Nix no KDE** reconstrói o menu de aplicativos e reinicia o shell Plasma na sessão atual, sem atualizar pacotes nem alterar o perfil. A segunda ação não usa privilégios de administrador e exige confirmação própria. Migrar para a versão Stable mais recente exige uma verificação oficial recente nesta instância que indique uma atualização disponível; o histórico salvo, sozinho, não autoriza a ação.

## Histórico

**Histórico** reúne contagens da sessão, quantidade de logs persistidos, operações recentes, estados e caminhos. Também permite atualizar os dados, abrir a saída salva e navegar diretamente para Verificar ou Aplicar.

## Onde os logs ficam

Os novos logs são guardados localmente, no estado privado da release em que a aplicação foi executada. A raiz agora separa destino e ação:

```text
.alpine-state/web/<versao-frontend>/logs/
├── verify/
│   ├── backend/
│   ├── system/
│   ├── all-modules/
│   └── modules/<id-do-modulo>/
├── apply/
│   ├── preview/
│   ├── all-modules/
│   ├── diagnostics/
│   └── modules/<id-do-modulo>/
└── nix/
    ├── stable-check/
    ├── stable-migration/
    ├── profile-apps/
    └── kde-refresh/
```

Cada operação grava `<id-da-operacao>.log` na pasta correspondente. Por exemplo, a checagem do canal Stable usa `logs/nix/stable-check/`; **Atualizar aplicativos Nix** usa `logs/nix/profile-apps/`; **Recarregar apps Nix no KDE** usa `logs/nix/kde-refresh/`. Verificar e Aplicar mantêm suas próprias pastas, com subpastas separadas para cada módulo.

Por exemplo, numa release `0.1.0-alpha.37-web`, o log Stable ficará neste formato:

```text
.alpine-state/web/0.1.0-alpha.37-web/logs/nix/stable-check/<id-da-operacao>.log
```

O Histórico mostra o caminho completo e permite abrir a saída salva pelo ID. Diretórios de log são privados ao usuário local (modo `0700`) e os arquivos têm acesso restrito (modo `0600`). A retenção considera toda a árvore categorizada.

Logs criados por versões anteriores em `operations/general/` e `operations/modules/` continuam sendo encontrados e podem ser abertos; novos registros usam somente a estrutura `logs/` acima. Os logs ficam no diretório da release local e não são incluídos na versão limpa baixada do GitHub.

Os arquivos `.log` são privados ao usuário local (permissões restritas). A interface pede ao bridge somente o identificador gerado da operação; o servidor local não aceita um caminho de arquivo arbitrário vindo do navegador. A rota continua limitada ao bridge local e à sessão autorizada.

## Limites de segurança e validação

O resultado salvo comprova somente o que a operação registrou naquela execução. Um status histórico de Stable é exibido depois de reiniciar, mas não autoriza sozinho uma migração: o bridge exige uma checagem oficial bem-sucedida, recente e realizada na instância atual. A validade para migrar expira e também é invalidada quando operações relevantes começam.

A interface continua sem botão automático de Undo. As roles atuais não guardam baseline/snapshot suficiente para restaurar com segurança o estado anterior. Para testar Apply, use VM descartável e snapshot externo; esta alteração não substitui a validação manual em Alpine Linux real.
