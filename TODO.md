# Alpine Desktop Center Web — candidata local alpha.26

A alpha.26 é uma build local para repetir os testes de interface e operação, não uma release pública ou estável. Ela mantém o backend `v1.44-dev` fixado no commit `e07a1221c310a19a8c5450217476c8e3da105b8d`. A alpha.24 permanece retirada e não deve ser republicada.

## Implementado

- [x] Bridge com allowlist, autenticação privilegiada em terminal externo, cookies `HttpOnly`, loopback e manifesto SHA-256.
- [x] Backend candidato sem regra ampla `doas nopass`; autorização única pelo terminal, limpeza fail-closed de dois drop-ins legados e `su` nas transições internas do Ansible.
- [x] Testes automatizados e CI verde para o backend (`e07a122`) e a candidata alpha.25.
- [x] Licença MIT nos dois repositórios e no pacote portátil.
- [x] Corrigir o cursor: `not-allowed` para ações desabilitadas por gate; `progress` somente enquanto há operação realmente em execução.
- [x] Corrigir o tema claro: valores `--muted`/`--faint` no CSS base que antes eram redefinidos para contraste insuficiente; estilizar o Apply desabilitado com texto legível.
- [x] Melhorar a mensagem de espera da operação do módulo, orientando a verificar o terminal separado e **Show logs** sem repetir a ação.

## Bloqueios antes de publicar

- [ ] Executar a alpha.26 em VM Alpine 3.24.3 descartável com snapshot; verificar legibilidade no KDE e se o cursor do Apply desabilitado já não indica carregamento.
- [ ] Confirmar a razão exibida ao lado do Apply, rodar diagnóstico do módulo e das dependências, e só então validar o Apply quando todos os estados necessários estiverem recentes e `complete`.
- [ ] Se a operação ficar em andamento, inspecionar o terminal separado e logs em `.alpine-state/web/0.1.0-alpha.26-web/operations/`; não iniciar novamente a mesma operação sem conferir o estado.
- [ ] Testar `doas`, playbook, transição `su`, ausência de drop-ins `nopass` após sucesso/interrupção e compatibilidade dos terminais.
- [x] CI verde do frontend alpha.26 após o push.
- [ ] Rever preview Ansible (continua best-effort), cancelamento/recuperação, acessibilidade e matriz de plataformas.

**Critério de saída:** não publicar nem chamar de estável antes dos testes de integração na VM real. Usar somente uma VM descartável com snapshot; nunca testar Apply em uma instalação com dados importantes.
