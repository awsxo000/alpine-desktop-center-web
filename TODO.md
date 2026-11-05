# Alpine Desktop Center Web — candidata local alpha.25

A alpha.25 é uma candidata de teste, não uma versão estável nem uma release pública. Ela incorpora o backend do branch `fix/one-shot-doas-authorization`, commit `e07a1221c310a19a8c5450217476c8e3da105b8d`, sob o rótulo explícito `v1.44-dev`. A alpha.24, que usava backend v1.43, foi retirada: a release está em rascunho e sua tag pública foi removida.

## Implementado

- [x] Bridge do frontend com allowlist de operações, autenticação somente em terminal externo, cookie `HttpOnly`, restrição a loopback e validação de sessão/backend.
- [x] Gates de diagnóstico/dependência, migração Nix Stable, validação de schema e manifesto SHA-256.
- [x] No backend: remover o wrapper que criava uma regra ampla `doas nopass`; fazer uma única transição `doas -u root` no terminal e usar `su` para as transições internas do Ansible.
- [x] Na primeira operação privilegiada, remover os dois drop-ins amplos conhecidos de versões antigas antes de executar Ansible; falhar fechado se a remoção não for possível.
- [x] Adicionar teste de regressão e CI do backend. A CI do backend passou no commit `e07a122` (sintaxe shell e verificação do modelo de privilégio).
- [x] Fixar o backend candidato pelo SHA no empacotador/CI do frontend e incluir `LICENSE` no pacote portátil.
- [x] Escolher e adicionar MIT aos repositórios frontend e backend.

## Bloqueios antes de publicar

- [ ] Testar o artefato alpha.25 numa VM Alpine 3.24.3 descartável com snapshot: terminal visível, prompt `doas` fora do browser, operação Ansible, transição `su` para o usuário desktop e confirmação de que nenhum drop-in `nopass` permanece.
- [ ] Interromper uma operação na VM (inclusive encerramento abrupto) e verificar que não ficam regras de autorização temporária, serviços ou processos órfãos; validar a remoção das duas regras legadas conhecidas.
- [ ] Validar Konsole, xterm e XFCE Terminal; confirmar recuperação quando o terminal fecha ou `apk`/rede está bloqueado.
- [ ] Rodar e obter CI verde do frontend após a troca de pin e do pacote alpha.25.
- [ ] Rever prévia Ansible: continua best-effort e não prova ausência de efeitos para tarefas sem suporte a check mode.
- [ ] Completar documentação de contribuição, matriz de plataformas e procedimentos de recuperação; revisar acessibilidade e cancelamento.

**Critério de saída:** não publicar nem chamar de estável antes de validar o artefato alpha.25 em VM real e concluir os checks de integração. Usar somente VM descartável com snapshot; nunca testar Apply em uma instalação com dados importantes.
