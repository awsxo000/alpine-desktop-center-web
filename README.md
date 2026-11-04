# Alpine Desktop Center Web

> **Web era begins here.** This repository is the browser-first continuation of Alpine Desktop Center. The original desktop direction remains part of the project's history; this line makes the local browser experience the primary interface.

This project is the browser-first migration of Alpine Desktop Center. The web interface is designed as a calm, transparent system installer: a left-hand flow of explicit steps, an inspection-first main panel, protected execution states and a live audit stream.

The first vertical slice is intentionally honest about its boundary. It renders the browser experience and sends only named operation requests to `/api/operations/*`; the local bridge that connects those requests to the embedded Ansible backend is the next implementation layer. No arbitrary shell input is accepted by the client.

The visual direction uses the user's [Rokko institutional site](https://rokko-institucional.pages.dev/) as its color reference: light gray canvas, white panels, deep institutional green and vivid green selection states. Agama/openSUSE is used only as a structural reference for clarity and clean information density, not as the visual identity.

The target release keeps the embedded backend, the SHA-256 integrity lock, version-namespaced logs, structured diagnostics, Stable-only Nix controls and independent terminal execution. The browser is the primary user experience; the backend remains the source of truth.

## Portable browser mode

The release is designed to run without external hosting. Extract the package and double-click `Alpine Desktop Center`. The launcher starts a Python HTTP server bound only to `127.0.0.1`, validates the embedded backend, and opens the default browser. The browser talks only to that local process; logs and state remain inside the release directory. The first test package exposes the health check and validation operation through the local bridge. Other named execution adapters are deliberately reported as pending rather than simulated.

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
