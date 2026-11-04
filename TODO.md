# Alpine Desktop Center Web — delivery outcomes

## Browser-first installer flow

- [x] The primary experience is a browser application, not a Qt window.
- [x] The flow exposes clear steps for Welcome, Backend validation, System checks, Modules, Configuration, Execution and Summary.
- [x] The interface communicates the current step, progress, blockers and the next safe action.

## Safe local backend bridge

- [ ] The embedded Ansible backend remains the source of truth and cannot be replaced by an external backend.
- [ ] SHA-256 validation is required before every executable action and repeated immediately before launch.
- [ ] If integrity fails, execution controls are blocked while validation and local history remain available.
- [ ] Only named operations are exposed; the web interface never accepts arbitrary shell text.

## Transparent execution

- [ ] Global and module actions expose real process state, named operation, live output and terminal-style logs in the browser.
- [ ] Waiting states explain doas authentication, network, repositories and apk locks.
- [ ] The doas password is never collected or stored by the web application.

## Modules, Stable Nix and audit history

- [ ] Current modules, structured diagnostics and module-specific execution remain available.
- [ ] Nix controls expose only official Stable channels; Unstable is not shown.
- [ ] The central audit view lists live activity, global actions, module runs and diagnostic history.
- [ ] Logs and runtime state remain inside the release directory and are namespaced by frontend version.

## Browser delivery

- [x] The web project has a healthy Preview listener and a synchronized route manifest.
- [x] The first vertical slice is typechecked, buildable and checkpointed in the managed project repository.
- [ ] The local release launcher opens the browser application while preserving independent terminal execution of the backend.
