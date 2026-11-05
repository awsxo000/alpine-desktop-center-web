# Alpine Desktop Center Web — alpha.28

A alpha.28 é uma candidata de teste para Alpine 3.24.3/KDE, não uma versão estável. Ela fixa o backend `v1.44-dev` no commit `52712cb7872792c04495d8b63d1a917a35861e31`. A alpha.24 segue retirada.

## Correção incluída

A alpha.27 teve uma primeira falha ao executar `nix-channel --update`, causada pelo relógio da VM e pela validade TLS. O Nix gravou a URL do canal antes da falha. Na tentativa posterior, a alpha.27 viu a URL já cadastrada, pulou a atualização e a role Steam terminou com `attribute 'nixpkgs' not found`.

A alpha.28 consulta se o conteúdo local do canal existe em `~/.nix-defexpr/channels/<nome>`. Se estiver ausente, ela tenta novamente `nix-channel --update` antes de instalar pacotes. A correção tem teste de regressão no backend. Mantenha o horário correto e a validação TLS habilitada.

## Teste de integração pendente

Use apenas VM Alpine 3.24.3/KDE descartável com snapshot. Na alpha.28, execute primeiro **Check status** e verifique a condição dos canais Nix. Depois teste a aplicação do módulo que falhou, confirmando que a atualização do canal é tentada se o cache local não existir e que Steam deixa de retornar `attribute 'nixpkgs' not found`.

Como a alpha.27 já aplicou parte da configuração antes de falhar, não repita aquela versão às cegas nem considere que houve rollback. A alpha.28 também precisa de nova validação de **Apply all modules**, checks individuais PipeWire/WirePlumber, logs gerais e por módulo, terminais Konsole/xterm/XFCE Terminal e tema escuro. Após sucesso ou interrupção, confira que não há regra ampla `doas nopass` nem processo órfão.

Antes da distribuição, verificar CI do commit exato e validar o SHA-256 do tarball contra o asset da release. Não é estável: a senha `doas` continua sendo pedida no terminal externo; não digite credenciais na UI nem desative TLS.
