# Alpine Desktop Center Web

> **Web era begins here.** This repository is the browser-first continuation of Alpine Desktop Center. The original desktop direction remains part of the project's history; this line makes the local browser experience the primary interface.

This project is the browser-first migration of Alpine Desktop Center. The web interface is designed as a calm, transparent system installer: a left-hand flow of explicit steps, an inspection-first main panel, protected execution states and a live audit stream.

The current backend is a post-install configurator, not an operating-system installer: Alpine must already be installed with `setup-alpine` and the graphical desktop prepared with `setup-desktop`. The backend currently targets Alpine Linux 3.24.3 Stable; supported hardware and desktop combinations still require validation on real Alpine installations.

> **Alpha safety status:** the withdrawn alpha.24 artifact embeds backend v1.43, which temporarily adds a broad `doas nopass` rule that can remain after a crash. The local alpha.26 candidate embeds the fixed backend branch at a pinned commit and no longer creates that rule, but it has not yet been tested on a real Alpine VM. Use alpha.26 only in a disposable VM with a snapshot; do not use either candidate on a production system.

The local bridge executes named operations against the alpha.26 candidate backend (`v1.44-dev`). It supports structured diagnostics, Stable Nix checks and migration, Nix application refresh, full Apply, diagnostic Apply and module Apply. No arbitrary shell input is accepted by the client, and each operation records its output under `.alpine-state/web/operations/`.

The visual direction uses the user's [Rokko institutional site](https://rokko-institucional.pages.dev/) as its color reference: `#f4f6fa` surfaces, `#123c9c` blue actions, `#071225` ink and `#1d9b62` success states. Agama/openSUSE is used only as a structural reference for clarity and clean information density, not as the visual identity.

The target release keeps the embedded backend, the SHA-256 integrity lock, version-namespaced logs, structured diagnostics, Stable-only Nix controls and independent terminal execution. The browser is the primary user experience; the backend remains the source of truth.

## Portable browser mode

The release is designed to run without external hosting. Extract the package and run `install-desktop.sh` once to register Alpine Desktop Center in the user application menu. Then launch **Alpine Desktop Center** from that menu. The launcher starts a Python HTTP server bound only to `127.0.0.1`, validates the embedded backend, and opens the dedicated local browser window. The browser talks only to that local process; logs and state remain inside the release directory. Privileged operations open a separate system terminal; enter any doas password or confirmation only there. The browser does not receive terminal input.

The current system-terminal integration supports Konsole, xterm and XFCE Terminal. On a
desktop without one of these, operations requiring that terminal are blocked with an error;
read-only diagnostics can still use the browser window.

The session token is stored in a user-private file and is not passed in the
browser URL, browser process arguments or frontend JavaScript. The local page
receives it as an `HttpOnly; SameSite=Strict` cookie.

If backend prerequisites such as `make` or Ansible are missing, the application
prepares them in that system terminal before running a privileged operation.
Read-only diagnostics stay in the app window and never request a password.

The Configuration section offers **Preview configuration**, which runs the
backend `make simular` target (`ansible-playbook --check --diff`). This is a
best-effort preview, not a guarantee: Ansible tasks without check-mode support
may be skipped. If `make`, Ansible, the collection or prepared release-local
state is missing, the preview is blocked rather than installing prerequisites.
Review the full output in the system terminal and use a VM snapshot; the UI
still requires a separate explicit confirmation before Apply.

**Apply module** is disabled until that module has a recent valid live
diagnostic (not `unknown`) and every declared dependency has a recent `complete` diagnostic.
The module diagnostic's dependency declaration must also match the live catalog.
The backend and UI enforce this gate; an `unknown` module status is not treated
as success. A check older than 10 minutes expires and must be rerun.

Stable migration is enabled only after a successful check of the official Nix
Stable source reports `update_available`. Both UI and bridge require the result
to be no older than 10 minutes; another check or system-changing operation
invalidates it. **Validate again** refreshes bridge health and module catalog
after a successful integrity recheck, without requiring a browser restart.

Use `Alpine Desktop Center.desktop` from the desktop environment, or the
registered **Alpine Desktop Center** menu entry, to get the app-style browser
window with `Terminal=false`. When launching from an existing shell, that shell
remains open by design because it belongs to the user's terminal, not to Alpine
Desktop Center. Firefox or Chromium is used only as the rendering window;
privileged authentication happens in a separate system terminal.

## Development

```sh
pnpm install --frozen-lockfile
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
`RELEASE-VERSIONS`. The alpha.26 test package uses backend candidate `v1.44-dev`
from branch `fix/one-shot-doas-authorization`, pinned to commit
`e07a1221c310a19a8c5450217476c8e3da105b8d`. This is a development candidate,
not an official backend release; the packager rejects a different SHA for this
pin. The old v1.43 pin is retained only for historical reproducibility.

```sh
sh scripts/package-portable.sh 0.1.0-alpha.26-web v1.44-dev
```

The resulting archive contains `frontend/`, `server/` and `backend/` in one
self-contained directory. To package a local backend checkout instead of
cloning the official tag, set `BACKEND_SOURCE`:

```sh
BACKEND_SOURCE=/path/to/alpine \
  sh scripts/package-portable.sh 0.1.0-alpha.26-web v1.44-dev
```

The backend must remain beside the launcher in the extracted release. The
launcher validates it before opening the browser, and the web bridge validates
its checksums again before every named operation.

The packager removes write bits from the embedded backend tree to reduce
accidental edits between validation and use. `BACKEND-MANIFEST.sha256` detects
content drift but is not a cryptographic signature of the release; users who
can modify their own release directory remain in control of it.

## License

This repository is licensed under the MIT License. See [LICENSE](LICENSE).
