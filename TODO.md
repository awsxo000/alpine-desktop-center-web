# Alpine Desktop Center Web — status da candidata alpha.24

A alpha.24-web é uma candidata de teste isolado, não uma versão estável. O projeto é um configurador pós-instalação: requer Alpine já instalado e ambiente gráfico preparado. Esta candidata embute o backend `v1.43` do repositório separado `awsxo000/alpine`.

## Implementado nesta candidata

- [x] Bridge fechado em operações nomeadas; removida a rota de entrada PTY livre do navegador.
- [x] Apply pede confirmação; credenciais de `doas` são digitadas em terminal do sistema, nunca no browser. Operações que podem elevar privilégio são classificadas para esse terminal.
- [x] Token gerado por lançamento, arquivo privado criado atomicamente, cookie de sessão `HttpOnly; SameSite=Strict`; token não está em URL, argv nem JavaScript.
- [x] Bridge é loopback-only, valida IP remoto e Host/Origin estritos, limita request bodies e bloqueia instância duplicada do servidor/launcher.
- [x] Manifesto SHA-256 rejeita conteúdo vazio, linhas malformadas, caminhos inseguros, duplicatas, symlinks, ausência, extras ou conteúdo alterado; o backend empacotado perde permissões de escrita por padrão.
- [x] Health/schema, catálogo, sessão e JSON de diagnóstico têm validação runtime. Operações param se o release metadata não declara schema 1.
- [x] Apply de módulo exige diagnóstico recente (até 10 min) do módulo, lista de dependências igual ao catálogo e estado `complete` recente em cada dependência, tanto na UI quanto no servidor. Diagnóstico desconhecido não vira sucesso; warnings aparecem como atenção.
- [x] Migração Stable exige, na UI e no bridge, relatório oficial coerente `update_available` obtido há no máximo 10 min; novo check/mutação invalida o relatório anterior.
- [x] Prévia `make simular` bloqueia se faltar pré-requisito/estado preparado e não instala dependências automaticamente. Continua best-effort, não plano completo.
- [x] Timeout de PTY rastreia e tenta matar descendentes, impõe hard stop e bloqueia novos comandos se detectar PID residual. Output e sessões são limitados; logs antigos são podados.
- [x] Log de validação do backend é criado com permissão privada; arquivos temporários do terminal são limpos em saídas normais, falhas e timeout.
- [x] Empacotador exige checkout frontend limpo, lockfile congelado, versão consistente, checkout Git verificável e SHA imutável do backend v1.43; valida pacote antes do tarball e rejeita override de SHA.
- [x] Workflow CI adicionado para typecheck, testes, build, sintaxe shell, Desktop Entry e empacotamento repetido/verificação de SHA idêntico do tarball sem publicar.
- [x] GitHub Actions do workflow pinadas em SHAs completos; YAML parseado localmente.

## Bloqueios antes de uso amplo ou versão estável

- [ ] Corrigir no backend `awsxo000/alpine` o modelo de privilégio: `scripts/executar-com-doas-temporario.sh` instala `permit nopass <usuário>` global em `/etc/doas.d` e só o remove no encerramento normal/por trap; `SIGKILL`, falha elétrica ou crash podem deixar a regra ampla instalada. Não anunciar como estável nem recomendar em máquina de produção enquanto isso não for redesenhado/testado.
- [ ] Tornar a prévia abrangente: o Ansible check mode pode ignorar tarefas sem suporte e não demonstra todos os efeitos; revisar playbook e tarefas externas antes de tratar a saída como plano seguro.
- [ ] Testar a candidata numa VM Alpine descartável com snapshot: diagnóstico, prévia, depois um módulo reversível; incluir rede indisponível, lock do apk, fechamento do terminal, crash e recuperação.
- [ ] Validar Konsole `--nofork`, xterm e xfce4-terminal nas sessões e ambientes oficialmente suportados; implementar cancelamento explícito e testar todos os caminhos de encerramento.
- [ ] Integrar logs de operações anteriores no painel e persistir histórico estruturado sem segredos; os cartões de resumo atuais contam apenas a sessão.
- [ ] Confirmar uma execução verde do workflow no GitHub após subir esta candidata.
- [ ] Adicionar testes automatizados de frontend para parser Stable, expiração de diagnóstico, recuperação Validate e gates de Apply/migração.
- [ ] Escolher e adicionar licença open source com decisão do mantenedor antes de anunciar o projeto à comunidade como open source.
- [ ] Avaliar assinatura verificável para artefatos. O manifesto detecta drift local, mas não autentica a origem da release.
- [ ] Revisar acessibilidade, foco/teclado, leitor de tela, Firefox/Chromium e operação KDE/OpenRC nas plataformas suportadas.
- [ ] Definir matriz oficial de hardware, desktop, kernel, repositórios e versões Alpine; documentar backup e recuperação.

## Critério de saída de alpha

Não chamar de estável até que o mecanismo `doas`, a prévia, o teste real em Alpine, cancelamento/recuperação, CI, licença, assinatura/entrega e matriz de plataforma estejam concluídos e revisados.
