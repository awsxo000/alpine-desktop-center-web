# Alpine Desktop Center Web

This project is the browser-first migration of Alpine Desktop Center. The web interface is designed as a calm, transparent system installer: a left-hand flow of explicit steps, an inspection-first main panel, protected execution states and a live audit stream.

The first vertical slice is intentionally honest about its boundary. It renders the browser experience and sends only named operation requests to `/api/operations/*`; the local bridge that connects those requests to the embedded Ansible backend is the next implementation layer. No arbitrary shell input is accepted by the client.

The target release keeps the embedded backend, the SHA-256 integrity lock, version-namespaced logs, structured diagnostics, Stable-only Nix controls and independent terminal execution. The browser is the primary user experience; the backend remains the source of truth.

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
