# Alpine Desktop Center Web — estado atual

**Data do resumo:** 2026-11-07  
**Branch:** `main`  
**Commit atual:** `6197def` — `release: prepare Alpha 63`
**Versão do frontend:** `0.1.0-alpha.63-web`
**Backend embarcado:** `v1.44-dev`  
**Status:** pré-release funcional para validação em VM Alpine; não é uma versão estável para produção.

## Visão geral

O Alpine Desktop Center é uma aplicação browser-first para configurar um Alpine Linux já instalado. O sistema operacional não é instalado pela aplicação. A interface web conversa somente com um bridge Python local, vinculado a `127.0.0.1`, e o backend é embarcado dentro do pacote de distribuição.

A aplicação organiza o fluxo em cinco áreas: **Home**, **Verify**, **Apply**, **Nix** e **History**. O princípio atual é inspeção antes de alteração: diagnósticos somente leitura ficam separados das operações que modificam o sistema.

## Arquitetura atual

```text
Aplicação web React/Vite
        |
        | HTTP local + token privado
        v
Bridge Python server/local_server.py
        |
        | operações nomeadas e allowlisted
        +--> diagnósticos somente leitura
        +--> operações Nix no perfil do usuário
        +--> helper Polkit para operações privilegiadas
        v
Backend Ansible embarcado + scripts do Alpine
```

O bridge valida `BACKEND-MANIFEST.sha256` antes de executar operações. O frontend nunca envia shell arbitrário. Cada operação possui um identificador conhecido, payload validado e log privado persistente.

## Funcionalidades implementadas

### Interface e identidade

- Interface React/Vite com temas claro e escuro.
- Localização em português brasileiro e inglês dos Estados Unidos.
- Nova identidade visual com símbolo vetorial Alpine, favicon e ícone do aplicativo.
- Launcher para duplo clique e desktop entry compatível com KDE/GLib.
- Chromium/Chrome em modo aplicativo fullscreen; Firefox em kiosk mode.
- Estado de inicialização com validação do ambiente, bridge e catálogo.

### Verificação e módulos

- Validação da integridade do backend embarcado.
- Diagnóstico individual ou de todos os módulos.
- Catálogo de módulos filtrado conforme o desktop detectado.
- Gates de segurança para Apply:
  - diagnóstico recente;
  - status diferente de `unknown`;
  - dependências completas;
  - catálogo compatível;
  - manifesto do backend válido.
- Diagnósticos expiram após 10 minutos.
- O módulo KDE permanece restrito a ambientes KDE.

### Nix

- Detecção de Nix e canal configurado.
- Verificação e migração condicionada do canal Stable.
- Listagem, atualização, instalação e desinstalação de aplicativos do perfil do usuário.
- Coleta de lixo do perfil Nix.
- Atualização separada do perfil Nix e refresh do menu de aplicativos KDE/Plasma.
- Busca de pacotes sem abrir terminal externo.
- Busca moderna com `nix search --json` quando o comando `nix` existe.
- Fallback para `nix-env --query --available` em instalações antigas.
- Cache de consultas repetidas por cinco minutos.
- Atributos e nomes de pacotes são validados antes de qualquer instalação ou desinstalação.

### Logs e estado

- Logs por operação e categoria:
  - `logs/verify/`
  - `logs/apply/`
  - `logs/nix/`
- Histórico com os últimos 50 registros persistentes.
- Logs privados com permissões restritivas.
- Em instalação portátil, o estado fica no diretório da release.
- Em instalação APK, o estado fica em:

```text
${XDG_STATE_HOME:-~/.local/state}/alpine-desktop-center
```

A Alpha 60 corrigiu a falha em que o bridge instalado em `/usr/lib` tentava tratar logs do diretório do usuário como se fossem parte do pacote.

## Polkit

A Alpha 61 introduziu o fluxo Polkit para operações privilegiadas.

Arquivos instalados pelo APK:

```text
/usr/libexec/alpine-desktop-center-helper
/usr/share/polkit-1/actions/org.alpine.desktop-center.policy
```

O bridge continua como usuário normal. Para Apply, preparação do Ansible e migração Stable, ele chama `pkexec` com uma operação allowlisted. O helper executa como root somente a ação correspondente.

O helper valida novamente:

- execução como root via Polkit;
- existência do backend instalado;
- usuário chamador fornecido por `PKEXEC_UID`;
- diretório de estado pertencente ao usuário;
- identificador da operação;
- identificador do módulo.

Operações aceitas pelo helper:

```text
prepare
simulate-full
apply-full
apply-diagnostics
apply-module
migrate-stable-channel
```

A aplicação não deve ser executada como root e não cria uma regra global `doas nopass`.

## Empacotamento e distribuição

O projeto possui dois fluxos:

### Pacote portátil

`./scripts/package-portable.sh` gera um tarball com:

- frontend compilado;
- bridge Python;
- backend Ansible embarcado;
- `BACKEND-MANIFEST.sha256`;
- launcher e desktop entry;
- assets Polkit;
- documentação e versão da release.

Artefato local atual:

```text
dist-portable/Alpine-Desktop-Center-Web-v0.1.0-alpha.63-web.tar.gz
```

### Pacote Alpine APK

O recipe está em:

```text
packaging/alpine/APKBUILD
```

Ele instala frontend, bridge, backend, launcher, desktop entry, helper Polkit e policy Polkit. A construção nativa precisa ser feita dentro do Alpine com `abuild`; o sandbox Ubuntu não gera um APK Alpine assinado.

Fluxo na VM Alpine:

```sh
cd ~/Documents/alpine-desktop-center-web
git restore packaging/alpine/APKBUILD
git pull --ff-only origin main
cd packaging/alpine
abuild checksum
abuild -r
APK=$(find "$HOME/packages" -type f -name 'alpine-desktop-center-0.1.0_alpha63-*.apk' | head -n 1)
doas apk add --upgrade --allow-untrusted "$APK"
```

A release publicada é:

[Alpha 63](https://github.com/awsxo000/alpine-desktop-center-web/releases/tag/v0.1.0-alpha.63-web)

Assets publicados:

```text
Alpine-Desktop-Center-Web-v0.1.0-alpha.63-web.tar.gz
Alpine-Desktop-Center-Web-v0.1.0-alpha.63-web.tar.gz.sha256
```

Checksum SHA-256 do tarball Alpha 63:

```text
9fed3c85f05871c5fa622de68288c0d6afd577a3a7981782b79443600a993b5a
```

## Validação atual

A última validação executou:

- 61 testes Python;
- `pnpm check`;
- `pnpm build`;
- sintaxe shell do helper Polkit;
- parsing XML da policy Polkit;
- `git diff --check`;
- inspeção do tarball completo;
- confirmação da presença do backend e do manifesto;
- confirmação da presença do helper e da policy no tarball.

O checkout está limpo e sincronizado:

```text
## main...origin/main
```

## Principais correções recentes

- Alpha 55: correção do duplo clique pelo desktop entry.
- Alpha 56/57: correções de readiness, health check e launcher.
- Alpha 58/59: preparação do APK e estado externo gravável.
- Alpha 60: correção dos caminhos de log fora de `/usr/lib`.
- Alpha 61: integração do Polkit e remoção do terminal externo para operações privilegiadas.
- Alpha 63: busca Nix moderna com `nix search --json` e fallback legado.

## Pendências e riscos conhecidos

1. **Validação real do Polkit na VM:** ainda é necessário confirmar em uma sessão KDE limpa que o diálogo gráfico aparece, que a autenticação é aceita e que a operação retorna corretamente para o histórico.
2. **Agente Polkit:** se a sessão gráfica não tiver um authentication agent ativo, operações privilegiadas falharão claramente; diagnósticos somente leitura continuarão funcionando.
3. **Rollback:** não existe undo automático. Antes de Apply, deve ser usada uma snapshot da VM.
4. **Backend:** o alvo atual é Alpine Linux 3.24.3 Stable com backend `v1.44-dev`; combinações de hardware e desktop precisam de validação real.
5. **Bootstrap inicial:** se Python, Ansible, `make` ou navegador estiverem ausentes, o primeiro uso ainda pode abrir um terminal para o bootstrap do ambiente. Isso é separado do fluxo Polkit de operações privilegiadas.
6. **Documentação histórica:** alguns trechos antigos do README/TODO ainda mencionam Alpha 56/57 e o terminal externo. O código e o changelog já refletem Alpha 63; esses trechos devem ser consolidados em uma próxima limpeza documental.
7. **Compatibilidade Nix:** o caminho moderno depende do CLI `nix`; instalações antigas usam o fallback `nix-env`, que pode continuar mais lento.
8. **Assinatura do APK:** a instalação com `--allow-untrusted` é adequada apenas para a validação da VM. Para distribuição pública, o APK deve ser assinado e entregue por um repositório Alpine confiável.

## Próximo teste recomendado na VM

Depois de instalar a Alpha 63:

1. Abrir a aplicação pelo menu do desktop.
2. Executar **Validate again**.
3. Executar **Check all modules**.
4. Pesquisar um pacote comum, como `firefox`, e verificar se a resposta é imediata ou significativamente mais rápida.
5. Selecionar um módulo diagnosticado e iniciar **Apply module**.
6. Confirmar que aparece o diálogo Polkit, sem abrir Konsole, xterm ou outro terminal.
7. Confirmar a saída no painel de logs e no **History**.
8. Testar cancelamento da autenticação e confirmar que a operação termina como erro controlado, sem deixar processos root pendurados.
