# Verificações do sistema e histórico de logs

Este guia descreve a organização da pré-release `0.1.0-alpha.34-web`. Ela continua sendo uma versão alpha e ainda requer validação operacional em Alpine Linux real.

## Início: integridade e canal Stable

A página **Início** começa sem resultado salvo do canal: uma instalação limpa mostra **Não verificado**. Não há log Stable incluído no pacote. Ao atualizar o **Canal Stable**, a aplicação consulta a fonte oficial, salva a saída e mantém o último resultado depois de reiniciar.

A ação **Verificar novamente** na página **Verificar** valida os arquivos embutidos pelo manifesto SHA-256 e atualiza o catálogo de módulos. Se algum arquivo estiver alterado ou ausente, a resposta indica falha ou bloqueio em vez de manter um estado validado desatualizado. Essa verificação é somente para leitura.

## Verificar e Aplicar

**Verificar** concentra diagnósticos sem aplicar mudanças. É possível verificar um módulo por vez ou todos. Os resultados incluem status, horário, componentes aprovados/faltantes e avisos/erros. A página mostra o histórico recente e permite abrir os logs associados.

**Aplicar** é dedicado às mudanças: aplicar um módulo ou a configuração completa, além de pré-visualizar a configuração quando os pré-requisitos locais já existem. A aplicação individual permanece bloqueada até haver diagnóstico válido recente e dependências completas. A ação completa e a prévia exigem confirmação explícita.

## Nix

**Nix** agrupa as ações do canal oficial Stable — verificar o canal, atualizar os aplicativos Nix do perfil do usuário e migrar para a versão Stable mais recente. A migração exige uma verificação oficial recente nesta instância que indique uma atualização disponível; o histórico salvo, sozinho, não autoriza a ação.

## Histórico

**Histórico** reúne contagens da sessão, quantidade de logs persistidos, operações recentes, estados e caminhos. Também permite atualizar os dados, abrir a saída salva e navegar diretamente para Verificar ou Aplicar.

## Onde os logs ficam

Os logs são guardados localmente no diretório da release em que a aplicação foi executada e não são incluídos na versão limpa baixada do GitHub:

```text
.alpine-state/web/<versao-frontend>/operations/general/<id-da-operacao>.log
```

Uma checagem do canal Stable, uma execução de diagnósticos em lote e uma aplicação completa usam `operations/general/`. O identificador é gerado pela aplicação e segue o formato `YYYYMMDDTHHMMSSZ-<8 caracteres aleatórios>`.

Uma checagem ou aplicação isolada de módulo usa:

```text
.alpine-state/web/<versao-frontend>/operations/modules/<id-do-modulo>/<id-da-operacao>.log
```

Por exemplo, para a checagem de Stable na versão `0.1.0-alpha.34-web`, o arquivo ficará em `.alpine-state/web/0.1.0-alpha.34-web/operations/general/<id-da-operacao>.log`. O painel mostra o caminho efetivo em vez de exigir que a pessoa o adivinhe.

Os arquivos `.log` são privados ao usuário local (permissões restritas). A interface pede ao bridge somente o identificador gerado da operação; o servidor local não aceita um caminho de arquivo arbitrário vindo do navegador. A rota continua limitada ao bridge local e à sessão autorizada.

## Limites de segurança e validação

O resultado salvo comprova somente o que a operação registrou naquela execução. Um status histórico de Stable é exibido depois de reiniciar, mas não autoriza sozinho uma migração: o bridge exige uma checagem oficial bem-sucedida, recente e realizada na instância atual. A validade para migrar expira e também é invalidada quando operações relevantes começam.

A interface continua sem botão automático de Undo. As roles atuais não guardam baseline/snapshot suficiente para restaurar com segurança o estado anterior. Para testar Apply, use VM descartável e snapshot externo; esta alteração não substitui a validação manual em Alpine Linux real.
