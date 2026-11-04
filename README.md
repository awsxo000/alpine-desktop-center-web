# Alpine Desktop Center Web

> **Web era begins here.** This repository is the browser-first continuation of Alpine Desktop Center. The original desktop direction remains part of the project's history; this line makes the local browser experience the primary interface.

This project is the browser-first migration of Alpine Desktop Center. The web interface is designed as a calm, transparent system installer: a left-hand flow of explicit steps, an inspection-first main panel, protected execution states and a live audit stream.

The local bridge now executes the named operation requests against the embedded v1.43 backend. It supports structured diagnostics, Stable Nix checks and migration, Nix application refresh, full Apply, diagnostic Apply and module Apply. No arbitrary shell input is accepted by the client, and each operation records its output under `.alpine-state/web/operations/`.

The visual direction uses the user's [Rokko institutional site](https://rokko-institucional.pages.dev/) as its color reference: `#f4f6fa` surfaces, `#123c9c` blue actions, `#071225` ink and `#1d9b62` success states. Agama/openSUSE is used only as a structural reference for clarity and clean information density, not as the visual identity.

The target release keeps the embedded backend, the SHA-256 integrity lock, version-namespaced logs, structured diagnostics, Stable-only Nix controls and independent terminal execution. The browser is the primary user experience; the backend remains the source of truth.

## Portable browser mode

The release is designed to run without external hosting. Extract the package and double-click `Alpine Desktop Center`. The launcher starts a Python HTTP server bound only to `127.0.0.1`, validates the embedded backend, and opens the dedicated local browser window. The browser talks only to that local process; logs and state remain inside the release directory. Privileged operations use the existing doas path from the backend and report their captured output in the activity panel.

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
