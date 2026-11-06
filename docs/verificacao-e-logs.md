# Verificações do sistema e histórico de logs

Este guia descreve a organização da pré-release `0.1.0-alpha.33-web`. Ela continua sendo uma versão alpha e ainda requer validação operacional em Alpine Linux real.

## Welcome: integridade e canal Stable

O bloco **System signals** começa sem um resultado salvo do canal: a instalação limpa mostra **Not checked**. Não há log de check Stable incluído no pacote publicado. Ao acionar o ícone de atualização de **Stable channel**, a aplicação consulta o estado oficial do canal Stable, grava a saída da verificação e mantém o último resultado na tela Welcome após reiniciar a interface.

O botão de atualização de **Backend integrity** faz uma leitura real do bridge local: verifica novamente os arquivos embutidos pelo manifesto SHA-256 e atualiza o catálogo de módulos. Se o backend tiver sido alterado ou algum arquivo estiver faltando, a resposta passa a indicar falha/bloqueio, em vez de conservar o estado antigo como se ainda estivesse validado. Essa verificação é somente de leitura.

## System Check e Modules

**System Check** concentra os diagnósticos, sem aplicar mudanças. É possível conferir um módulo por vez ou executar a checagem de todos os módulos. Os resultados incluem status, horário, componentes aprovados/faltantes e avisos/erros. O painel também mostra as operações recentes salvas e permite abrir o log de cada uma.

**Modules** fica dedicado à aplicação: selecionar um módulo e usar **Apply module**, ou aplicar a configuração completa com **Apply all modules**. O botão de aplicação individual continua bloqueado até haver diagnóstico recente e dependências completas; para refazer um check, use System Check. A aba Configuration não oferece mais opção de canal Unstable nem o controle Apply all modules.

## Summary

**Summary** é um relatório funcional, não apenas uma tela de contadores. Mostra contagens desta sessão, quantidade de logs persistidos, operações recentes, status e caminhos, com ação para abrir a saída salva. Também oferece atalhos para System Check e aplicação de módulos e permite atualizar o histórico.

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

Por exemplo, para a checagem de Stable na versão `0.1.0-alpha.33-web`, o arquivo ficará em `.alpine-state/web/0.1.0-alpha.33-web/operations/general/<id-da-operacao>.log`. O painel mostra o caminho efetivo em vez de exigir que a pessoa o adivinhe.

Os arquivos `.log` são privados ao usuário local (permissões restritas). A interface pede ao bridge somente o identificador gerado da operação; o servidor local não aceita um caminho de arquivo arbitrário vindo do navegador. A rota continua limitada ao bridge local e à sessão autorizada.

## Limites de segurança e validação

O resultado salvo comprova somente o que a operação registrou naquela execução. Um status histórico de Stable é exibido depois de reiniciar, mas não autoriza sozinho uma migração: o bridge exige uma checagem oficial bem-sucedida, recente e realizada na instância atual. A validade para migrar expira e também é invalidada quando operações relevantes começam.

A interface continua sem botão automático de Undo. As roles atuais não guardam baseline/snapshot suficiente para restaurar com segurança o estado anterior. Para testar Apply, use VM descartável e snapshot externo; esta alteração não substitui a validação manual em Alpine Linux real.
