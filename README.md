# Alpine Desktop Center Web

> **Web era begins here.** This repository is the browser-first continuation of Alpine Desktop Center. The original desktop direction remains part of the project's history; this line makes the local browser experience the primary interface.

This project is the browser-first migration of Alpine Desktop Center. The web interface is designed as a calm, transparent system installer: a left-hand flow of explicit steps, an inspection-first main panel, protected execution states and a live audit stream.

The local bridge now executes the named operation requests against the embedded v1.43 backend. It supports structured diagnostics, Stable Nix checks and migration, Nix application refresh, full Apply, diagnostic Apply and module Apply. No arbitrary shell input is accepted by the client, and each operation records its output under `.alpine-state/web/operations/`.

The visual direction uses the user's [Rokko institutional site](https://rokko-institucional.pages.dev/) as its color reference: `#f4f6fa` surfaces, `#123c9c` blue actions, `#071225` ink and `#1d9b62` success states. Agama/openSUSE is used only as a structural reference for clarity and clean information density, not as the visual identity.

The target release keeps the embedded backend, the SHA-256 integrity lock, version-namespaced logs, structured diagnostics, Stable-only Nix controls and independent terminal execution. The browser is the primary user experience; the backend remains the source of truth.

## Portable browser mode

The release is designed to run without external hosting. Extract the package and run `install-desktop.sh` once to register Alpine Desktop Center in the user application menu. Then launch **Alpine Desktop Center** from that menu; this avoids treating the shell launcher as a generic executable and provides the single-click app entry. The launcher starts a Python HTTP server bound only to `127.0.0.1`, validates the embedded backend, and opens the dedicated local browser window. The browser talks only to that local process; logs and state remain inside the release directory. Privileged operations use the existing doas path from the backend and report their captured output in the activity panel.

Backend prerequisites such as `make`, Ansible or `doas` are prepared through
the embedded PTY terminal in the application when the first privileged
operation needs them. The terminal explains what it is preparing, shows the
installer output and is the only place where a privilege password may be
requested. The web application does not collect or store that password.
There is no external terminal for normal operations.

Use `Alpine Desktop Center.desktop` from the desktop environment, or the
registered **Alpine Desktop Center** menu entry, to get the single app-style
browser window with `Terminal=false`. When
launching from an existing shell, that shell remains open by design because it
belongs to the user's terminal, not to Alpine Desktop Center. Firefox or
Chromium is used only as the rendering window; operation interaction stays in
the embedded logs terminal.

## Development

```sh
pnpm install
pnpm dev
```

The app listens on port 3000. Build and typecheck with:

```sh
pnpm check
pnpm build
```

## Portable release with the official backend

The source repository keeps the web frontend and the Ansible backend in
separate repositories, matching the original Qt project. The portable release
builder combines this frontend with a pinned release of
[`awsxo000/alpine`](https://github.com/awsxo000/alpine), generates
`BACKEND-MANIFEST.sha256`, and records both the backend version and commit in
`RELEASE-VERSIONS`:

```sh
sh scripts/package-portable.sh 0.1.0-alpha.5-web v1.43
```

The resulting archive contains `frontend/`, `server/` and `backend/` in one
self-contained directory. To package a local backend checkout instead of
cloning the official tag, set `BACKEND_SOURCE`:

```sh
BACKEND_SOURCE=/path/to/alpine \
  sh scripts/package-portable.sh 0.1.0-alpha.5-web v1.43
```

The backend must remain beside the launcher in the extracted release. The
launcher validates it before opening the browser, and the web bridge validates
its checksums again before every named operation.
