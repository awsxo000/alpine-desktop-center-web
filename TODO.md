# Alpine Desktop Center Web — alpha.27

A alpha.27 é uma candidata de teste para Alpine 3.24.3/KDE, não uma versão estável. Ela fixa o backend `v1.44-dev` no commit `881558709d94539acc81bd06ef556ba3562dc07d`. A alpha.24 foi retirada; não republicar sua tag nem seu artefato.

## Implementado

- [x] Corrigir o erro de Apply observado na VM: o wrapper autorizado já chama `ansible-playbook`, então os quatro alvos do Make agora passam diretamente `playbooks/site.yml`; a regressão valida os quatro comandos de `make -n`.
- [x] Manter a autorização `doas` interativa em terminal do sistema; nenhum `nopass` amplo ou senha no browser.
- [x] Exibir, para cada módulo selecionado, o status e a mensagem de cada componente diagnosticado. Um componente ausente aparece como erro/aviso explícito; Apply pode reparar lacunas quando pré-requisitos e dependências permitem.
- [x] Expor **Apply all modules** em Modules e Configuration, preservando a confirmação explícita.
- [x] Gravar logs privados em `.alpine-state/web/<frontend-version>/operations/general/` para operações gerais e `modules/<module>/` para check/apply individual; mostrar o caminho na interface e listar logs aninhados pela API.
- [x] Corrigir contraste e hierarquia do modo claro com CSS carregado depois do tema compacto; elevar texto auxiliar para 11–12 px e diferenciar botão bloqueado; cursor normal durante operação, com atividade indicada pelo spinner/cartão.
- [x] Validação local de frontend: typecheck, build e 36 testes do bridge passaram antes do commit desta candidata.

## Pendências de integração

- [ ] Confirmar CI verde do frontend para o commit final e validar o tarball alpha.27 anexado à pre-release.
- [ ] Testar no KDE do Alpine 3.24.3, em VM descartável com snapshot, a autenticação no terminal do sistema e aplicar um módulo (por exemplo Audio); confirmar que o erro `the playbook: ansible-playbook could not be found` não retorna.
- [ ] Rodar Check status em Audio e conferir no painel os checks PipeWire/WirePlumber e suas mensagens quando algum componente estiver ausente.
- [ ] Aplicar todos os módulos somente em snapshot e verificar o log geral; aplicar isoladamente um módulo e verificar `operations/modules/<id>/` e o caminho exibido.
- [ ] Conferir visualmente tipografia/contraste no modo claro e o estado do botão bloqueado, além de Konsole, xterm e XFCE Terminal.
- [ ] Verificar após sucesso e interrupção que nenhuma regra ampla `doas nopass`, processo órfão ou arquivo temporário permanece; conferir `su` e propriedade dos logs.
- [ ] Revisar cancelamento/recuperação e o dry-run Ansible, que continua best-effort e não prova ausência de efeitos para tarefas sem suporte a check mode.

**Limite desta candidata:** a senha continua sendo pedida pelo `doas` no terminal externo. Não trocar por execução sem senha. Um fluxo totalmente dentro da UI exigiria desenho e revisão próprios de um helper privilegiado fixo com ação Polkit estreita; instalar apenas o agente KDE não converte `doas` em diálogo gráfico. A publicação alpha não significa que a integração de VM foi aprovada.
