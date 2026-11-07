# Guia para outro agente: compilar, atualizar e publicar

Este documento permite que outro agente continue o Alpine Desktop Center Web sem depender do contexto da sessão anterior.

## 1. Contexto obrigatório

O projeto é uma aplicação browser-first para Alpine Linux já instalado. O frontend é React/Vite, o bridge é Python, o backend Ansible é embarcado e operações privilegiadas passam pelo Polkit.

Não execute a aplicação como root. Não reintroduza `doas nopass`, não abra terminal externo para operações do perfil Nix e não aceite comandos shell arbitrários vindos do frontend.

Estado de referência no momento deste guia:

```text
branch: main
versão: 0.1.0-alpha.62-web
backend: v1.44-dev
backend commit: 52712cb7872792c04495d8b63d1a917a35861e31
último commit: f336fd2
```

A versão do frontend é definida em `package.json`. A versão do APK usa o mesmo valor, convertendo pontos e hífen conforme a convenção Alpine, por exemplo:

```text
0.1.0-alpha.62-web -> 0.1.0_alpha62
```

## 2. Antes de modificar qualquer coisa

```sh
cd ~/alpine-desktop-center-web

git fetch origin --tags
git switch main
git pull --ff-only origin main

git status --short --branch
git log -3 --oneline --decorate
```

O checkout deve estar limpo antes de empacotar. O script de distribuição recusa mudanças não commitadas.

Confira as ferramentas:

```sh
node --version
pnpm --version
python3 --version
git --version
```

O projeto espera Node.js 20.19 ou mais recente e pnpm 11.25 ou mais recente. A compilação nativa do APK deve ocorrer em Alpine com `abuild`; o sandbox Ubuntu não produz um APK Alpine confiável.

## 3. Fazer uma alteração de código

Depois de editar o frontend, bridge, helper ou documentação, execute:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
git diff --check
```

Para mudanças no bridge, rode diretamente também:

```sh
python3 -m unittest discover -s tests -v
```

Para mudanças no shell:

```sh
sh -n "Alpine Desktop Center"
sh -n launch-from-desktop.sh
sh -n install-desktop.sh
sh -n bootstrap-runtime.sh
sh -n scripts/package-portable.sh
sh -n scripts/build-alpine-apk.sh
```

Para mudanças no helper Polkit:

```sh
python3 -m py_compile server/local_server.py
python3 - <<'PY'
import xml.etree.ElementTree as ET
ET.parse('packaging/polkit/org.alpine.desktop-center.policy')
print('policy XML: OK')
PY
```

Adicione regressões antes de publicar quando corrigir um bug de launcher, caminho de estado, autorização, integridade, busca ou instalação.

## 4. Atualizar a versão

Quando a alteração estiver pronta, atualize no mínimo:

1. `package.json`, campo `version`;
2. `CHANGELOG.md`, com a nova versão no topo;
3. `TODO.md` ou documentação relevante, se o plano mudou;
4. `PROJECT-STATUS.md`, quando o estado do projeto mudou;
5. `packaging/alpine/APKBUILD`, mas somente depois de existir o tarball publicado da nova versão.

Exemplo de nova versão:

```text
0.1.0-alpha.63-web
```

A tag deve ser exatamente a versão com `v`:

```text
v0.1.0-alpha.63-web
```

Antes de criar a tag:

```sh
pnpm check
pnpm test
pnpm build
git diff --check
git status --short
```

Faça um commit de versão:

```sh
git add package.json pnpm-lock.yaml CHANGELOG.md TODO.md PROJECT-STATUS.md
# inclua somente os arquivos realmente alterados
git commit -m "release: prepare Alpha 63"
git push origin main
```

Se o `package.json` não mudou dependências, não altere o lockfile artificialmente.

## 5. Gerar o pacote portátil completo

O script `scripts/package-portable.sh` faz tudo isto automaticamente:

- verifica a versão;
- exige checkout limpo;
- fixa o commit do backend;
- clona o backend correto;
- instala dependências com lockfile;
- executa check, testes e build;
- copia frontend, bridge, backend, manifest, launcher, desktop entry e Polkit;
- valida o backend embarcado;
- cria o tarball determinístico.

Com o backend oficial atual:

```sh
./scripts/package-portable.sh \
  "$(node -p "require('./package.json').version")" \
  v1.44-dev
```

O script exige o commit pinado do backend:

```text
52712cb7872792c04495d8b63d1a917a35861e31
```

O resultado fica em `dist-portable/`:

```text
Alpine-Desktop-Center-Web-v0.1.0-alpha.XX-web.tar.gz
```

O script faz build em `dist/`, portanto o arquivo produzido não deve ser commitado. Confira o artefato:

```sh
ARCHIVE="dist-portable/Alpine-Desktop-Center-Web-v$(node -p "require('./package.json').version").tar.gz"
test -s "$ARCHIVE"
sha256sum "$ARCHIVE" | tee "$ARCHIVE.sha256"

tmpdir=$(mktemp -d)
tar -xzf "$ARCHIVE" -C "$tmpdir"
release_dir="$tmpdir/Alpine-Desktop-Center-Web-v$(node -p "require('./package.json').version")"
test -d "$release_dir/backend"
test -s "$release_dir/BACKEND-MANIFEST.sha256"
(cd "$release_dir/backend" && sha256sum -c "$release_dir/BACKEND-MANIFEST.sha256")
rm -rf "$tmpdir"
```

Nunca publique um tarball sem `backend/`, `BACKEND-MANIFEST.sha256`, `server/`, launcher e arquivos Polkit.

## 6. Criar e publicar a release

O workflow `.github/workflows/release.yml` é acionado quando uma tag com `alpha` é enviada. Ele recompila o pacote em ambiente limpo, valida o backend e anexa o tarball e o checksum à pré-release.

Fluxo normal:

```sh
VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"

git tag -a "$TAG" -m "Alpine Desktop Center Web $TAG"
git push origin "$TAG"
```

Acompanhe o workflow:

```sh
gh run list --workflow release.yml --limit 5
gh run watch
```

Verifique os assets:

```sh
gh release view "$TAG"
```

A release deve conter:

```text
Alpine-Desktop-Center-Web-v<versão>.tar.gz
Alpine-Desktop-Center-Web-v<versão>.tar.gz.sha256
```

### Recuperar uma release interrompida

Se a tag já existe e o workflow ou upload foi interrompido:

```sh
TAG=v0.1.0-alpha.XX-web
ARCHIVE="dist-portable/Alpine-Desktop-Center-Web-${TAG}.tar.gz"

# confira primeiro se o nome e a tag são os corretos
gh release view "$TAG"

test -s "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
gh release upload "$TAG" "$ARCHIVE" "$ARCHIVE.sha256" --clobber
gh release edit "$TAG" --prerelease
```

Não crie uma segunda tag com o mesmo conteúdo. Não publique um tarball gerado a partir de checkout sujo.

## 7. Atualizar o APKBUILD depois da release

Só faça esta etapa depois que o tarball estiver acessível na release do GitHub.

No Alpine ou em um ambiente com `abuild`, atualize `packaging/alpine/APKBUILD`:

```sh
cd packaging/alpine
```

Atualize estes campos:

```text
pkgver=0.1.0_alphaXX
source="https://github.com/awsxo000/alpine-desktop-center-web/releases/download/v0.1.0-alpha.XX-web/Alpine-Desktop-Center-Web-v0.1.0-alpha.XX-web.tar.gz"
_builddir="Alpine-Desktop-Center-Web-v0.1.0-alpha.XX-web"
```

Mantenha `pkgrel=0` para uma nova versão. Incremente `pkgrel` somente quando a mesma versão do upstream precisar de correção no recipe.

Regere o checksum:

```sh
abuild checksum
```

Confira o diff. O `sha256sums` deve conter o checksum do arquivo da nova URL, e não o checksum do diretório local.

Faça commit e envie:

```sh
cd ../..
git add packaging/alpine/APKBUILD
git diff --cached --check
git commit -m "packaging: pin Alpha XX APK archive"
git push origin main
```

## 8. Compilar o APK no Alpine

Na VM Alpine, os pré-requisitos usuais são:

```sh
doas apk add alpine-sdk abuild apk-tools git
```

O usuário precisa estar no grupo `abuild`:

```sh
doas addgroup "$USER" abuild
```

Depois de entrar no grupo, abra uma nova sessão ou use o mecanismo disponível no sistema. Algumas instalações mínimas não possuem `newgrp`; nesse caso, encerre a sessão gráfica/terminal e entre novamente.

Confirme:

```sh
id -nG
abuild-keygen -a -i
```

Compile:

```sh
cd ~/Documents/alpine-desktop-center-web
./scripts/build-alpine-apk.sh
```

O resultado costuma aparecer em:

```text
$HOME/packages/packaging/x86_64/alpine-desktop-center-<versão>-r0.apk
```

Também é possível executar diretamente:

```sh
cd packaging/alpine
abuild checksum
abuild -r
```

Instale ou atualize na VM:

```sh
APK=$(find "$HOME/packages" -type f -name 'alpine-desktop-center-*.apk' -printf '%T@ %p\n' \
  | sort -nr | awk 'NR==1 { $1=""; sub(/^ /, ""); print }')

test -n "$APK"
doas apk add --upgrade --allow-untrusted "$APK"
```

`--allow-untrusted` é aceitável somente para teste local. Para distribuição real, use assinatura e repositório confiável.

## 9. Validar a instalação

Depois de instalar:

```sh
pkill -f '/usr/lib/alpine-desktop-center/server/local_server.py' 2>/dev/null || true
alpine-desktop-center
```

Validar:

1. abrir pelo menu ou duplo clique, sem precisar de Konsole;
2. confirmar `Terminal=false` no desktop entry;
3. executar **Validate again**;
4. executar **Check all modules**;
5. conferir logs em `~/.local/state/alpine-desktop-center`;
6. pesquisar um pacote Nix e confirmar que não surge terminal externo;
7. instalar/desinstalar um pacote de teste do perfil do usuário;
8. iniciar uma operação Apply e confirmar o diálogo gráfico Polkit;
9. cancelar a senha e confirmar erro controlado;
10. autenticar e confirmar log no painel e em History;
11. conferir que o processo do bridge não está rodando como root.

Comandos úteis:

```sh
find ~/.local/state/alpine-desktop-center -maxdepth 5 -type f | sort
cat ~/.local/state/alpine-desktop-center/web/server.log 2>/dev/null || true
ps -ef | grep -E 'local_server|alpine-desktop-center' | grep -v grep
```

Se o bridge não iniciar, examine primeiro:

```sh
cat ~/.local/state/alpine-desktop-center/web/server.log
```

Não tente resolver um `503` apagando logs ou executando o bridge como root. Verifique backend, manifesto, permissões do estado, Python, Ansible, `make` e navegador.

## 10. Checklist final do agente

Antes de declarar a atualização concluída:

- [ ] branch atualizado e checkout limpo;
- [ ] versão alterada corretamente;
- [ ] changelog atualizado;
- [ ] `pnpm check` passou;
- [ ] testes passaram;
- [ ] build passou;
- [ ] shell e XML Polkit validados quando aplicável;
- [ ] tarball contém frontend, bridge, backend e manifesto;
- [ ] manifesto valida todos os arquivos do backend;
- [ ] release contém tarball e checksum;
- [ ] `APKBUILD` aponta para a release correta;
- [ ] `abuild checksum` passou;
- [ ] APK foi compilado em Alpine;
- [ ] APK foi instalado em VM descartável;
- [ ] duplo clique funcionou;
- [ ] busca Nix não abriu terminal;
- [ ] Polkit exibiu autenticação gráfica;
- [ ] logs e History foram verificados;
- [ ] nenhuma operação foi declarada como sucesso sem terminar;
- [ ] snapshot da VM foi preservada antes de Apply.
