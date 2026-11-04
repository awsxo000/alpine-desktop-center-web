# Alpine Desktop Center Web — delivery outcomes

## Browser-first installer flow

- [x] The primary experience is a browser application, not a Qt window.
- [x] The flow exposes clear steps for Welcome, Backend validation, System checks, Modules, Configuration, Execution and Summary.
- [x] The interface communicates the current step, progress, blockers and the next safe action.

## Safe local backend bridge

- [x] The embedded Ansible backend remains the source of truth and cannot be replaced by an external backend.
- [x] SHA-256 validation is required before every executable action and repeated immediately before launch.
- [x] If integrity fails, execution controls are blocked while validation and local history remain available.
- [x] Only named operations are exposed; the web interface never accepts arbitrary shell text.
- [x] The loopback API requires a random per-launch session token, accepts only the local Host and same-origin requests, and rejects missing or invalid Content-Type/Origin/Host headers.
- [x] Unknown `/api/*` routes return JSON 404 responses instead of the frontend fallback.
- [x] The server prevents concurrent Apply, module Apply, migration and refresh operations, independently of the React state.
- [x] A timed-out backend command terminates its complete process group rather than only the direct child.

## Transparent execution

- [x] Global and module actions execute real backend targets, expose the named operation and captured terminal-style output in the browser.
- [ ] Waiting states explain doas authentication, network, repositories and apk locks.
- [ ] The doas password is never collected or stored by the web application.
- [x] The launcher waits for `/api/health` before opening the dedicated browser window and passes the local session token to the frontend.

## Modules, Stable Nix and audit history

- [x] Current modules, structured diagnostics and module-specific execution remain available.
- [x] Nix controls expose only official Stable channels; Unstable is not shown.
- [ ] The central audit view lists live activity, global actions, module runs and diagnostic history.
- [ ] Logs and runtime state remain inside the release directory and are namespaced by frontend version.
- [x] Health, backend status, module catalog and operation history are served from local endpoints and are not represented as fixed success data in the UI.

## Browser delivery

- [x] The web project has a healthy Preview listener and a synchronized route manifest.
- [x] The first vertical slice is typechecked, buildable and checkpointed in the managed project repository.
- [x] The local release launcher opens the browser application while preserving independent terminal execution of the backend.
- [x] The local bridge executes the complete named operation allowlist against the embedded backend with captured output and release-local operation logs.
