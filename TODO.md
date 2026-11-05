# Alpine Desktop Center Web — alpha.28

A alpha.28 é uma candidata de teste para Alpine 3.24.3/KDE, não uma versão estável. Ela fixa o backend `v1.44-dev` no commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada.

## Correção recém-incluída

- [x] Após falha de `nix-channel --update`, verificar se o conteúdo do canal existe em `~/.nix-defexpr/channels/<nome>`; se o cache estiver ausente, repetir o download mesmo que o URL já esteja registrado.
- [x] Adicionar regressão backend para esse caminho de recuperação.
- [x] Manter autenticação `doas` no terminal do sistema, sem senha no browser nem regra ampla `nopass`.
- [x] A alpha.27 corrigiu o argumento duplicado do wrapper, expõe checks por componente, Apply all, logs por módulo/operação e contraste melhor no tema claro.

## Validação

- [x] Regressão backend, shell syntax, ordering/condition da task e `git diff --check` passaram localmente.
- [x] Typecheck, build e 36 testes do frontend passaram localmente em alpha.28.
- [x] CI do backend `52712cb` passou.
- [ ] Aguardar CI do frontend alpha.28.
- [ ] Gerar duas vezes o tarball alpha.28, comparar SHA e conferir manifest/versões.

## Teste em VM

- [ ] Não repetir Apply total na alpha.27: a execução anterior terminou parcialmente na role Steam. A configuração prévia já pode ter alterações.
- [ ] Na alpha.28, em snapshot descartável, primeiro executar **Check status** e validar o canal Nix; depois observar se a role repete `nix-channel --update` se o conteúdo estiver ausente.
- [ ] Repetir Apply módulo/geral só depois de revisar os checks e a saída do canal. Confirmar que a busca `nixpkgs.steam` funciona e que não retorna `attribute 'nixpkgs' not found`.
- [ ] Retestar áudio e estado PipeWire/WirePlumber, log individual em `operations/modules/<id>/`, log geral em `operations/general/`, terminais Konsole/xterm/XFCE e modo escuro quando o usuário puder.
- [ ] Após sucesso/interrupção, confirmar ausência dos dois drop-ins antigos e de processos órfãos.

**Segurança:** ainda é alpha. Usar exclusivamente VM descartável com snapshot. A senha `doas` continua no terminal externo. Não desabilitar verificação TLS nem contornar erro de certificado.
