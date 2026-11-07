# Alpine Desktop Center Web

> **Alpha 42 — environment-aware workspace.**
>
> **Web era begins here.** This repository is the browser-first continuation of Alpine Desktop Center. The original desktop direction remains part of the project's history; this line makes the local browser experience the primary interface.

This project is the browser-first migration of Alpine Desktop Center. The web interface is a calm, transparent post-install desktop configurator: a left-hand flow of explicit steps, an inspection-first main panel, protected execution states and a live audit stream.

The current backend is a post-install configurator, not an operating-system installer: Alpine must already be installed with `setup-alpine` and the graphical desktop prepared with `setup-desktop`. The backend currently targets Alpine Linux 3.24.3 Stable; supported hardware and desktop combinations still require validation on real Alpine installations.

> **Alpha safety status:** the withdrawn alpha.24 artifact embeds backend v1.43, which temporarily adds a broad `doas nopass` rule that can remain after a crash. The alpha.37 candidate keeps the fixed backend pin, organizes the interface into five destinations and separates two module checks: current system state versus readiness to apply. It remains an alpha, not a stable release; use only in a disposable VM with a snapshot.

The local bridge executes named operations against the pinned backend candidate (`v1.44-dev`). It supports structured diagnostics, Stable Nix checks and migration, Nix user-profile updates, the separate KDE menu-cache refresh/Plasma restart, full Apply, diagnostic Apply and module Apply. The KDE refresh does not upgrade Nix packages. No arbitrary shell input is accepted by the client. New private logs are stored under `.alpine-state/web/<frontend-version>/logs/{verify,apply,nix}/` with subfolders for the action and module; older `operations/general/` and `operations/modules/` logs remain readable.

The visual direction uses the user's [Rokko institutional site](https://rokko-institucional.pages.dev/) as its color reference: `#f4f6fa` surfaces, `#123c9c` blue actions, `#071225` ink and `#1d9b62` success states. Agama/openSUSE is used only as a structural reference for clarity and clean information density, not as the visual identity.

Alpha 42 filters the module catalog by the detected desktop session. Modules are shared by default; a backend catalog entry can restrict one with `desktop_targets`, for example `["kde"]` for a KDE-only module or `["shared", "gnome"]` for a shared/GNOME module. The bridge filters these entries before returning `/api/modules` and validates the same target again before an apply operation, so hiding a module in the UI is not the security boundary. The current KDE module remains restricted to KDE; future GNOME, XFCE and other desktop roles should declare their targets in the backend catalog. No placeholder desktop modules are advertised.

The Nix integration intentionally uses the classic channel-based CLI only: `nix-channel`, `nix-env` and `nix-collect-garbage`. It does not use flakes, `nix search`, `nix profile` or other experimental new-CLI flows. The Apps destination and Nix-specific modules are exposed only after the bridge confirms `nix-env` and a configured non-unstable channel for the user. Package search and installation must use validated channel attribute paths rather than arbitrary shell input.

The target release keeps the embedded backend, the SHA-256 integrity lock, version-namespaced logs, structured diagnostics, Stable-only Nix controls and independent terminal execution. The browser is the primary user experience; the backend remains the source of truth. Alpha 42 adds a startup workspace that detects KDE, GNOME and other desktop sessions before opening the main interface, then exposes desktop capabilities as a foundation for environment-specific modules.

## Purpose

Alpine Desktop Center configures an Alpine Linux desktop that is already installed. Its goal is to combine Alpine's lightweight Stable foundation with applications managed through the user's Nix profile and guided desktop modules such as audio, Bluetooth, NetworkManager and KDE. It checks the current state first and makes named changes only after explicit confirmation. It does not partition disks or install Alpine; complete `setup-alpine` and prepare the graphical desktop before using it.

## Portable browser mode

The release is designed to run without external hosting. Extract the package and run `install-desktop.sh` once to register Alpine Desktop Center in the user application menu. Then launch **Alpine Desktop Center** from that menu. The launcher starts a Python HTTP server bound only to `127.0.0.1`, validates the embedded backend, and opens Chromium/Chrome in a full-screen app window (Firefox uses kiosk mode). Press **F11** to leave Chromium/Chrome fullscreen; **Alt+F4** closes the application window. The browser talks only to the local process; logs and state remain inside the release directory. Privileged operations open a separate system terminal; enter any doas password or confirmation only there. The browser does not receive terminal input.

While a terminal operation is active, its command output is streamed into **Show logs** and the private operation log. Authentication prompts still appear only in the system terminal. **Verify** owns read-only module checks: installed packages, services and configuration describe the current Alpine system. **Apply** separately reports readiness based on a recent module diagnostic, complete checks for declared dependencies, and SHA-256 integrity of embedded backend files. Thus a missing component in the selected module can mean it needs installation; it does not by itself make the module unready. **Apply** is dedicated to applying one module or the full configuration, with a preview and explicit confirmation. **Nix** groups Stable-channel checks with Nix application refresh/migration, while **History** combines session totals and persistent local operation logs. Hover/focus colors are tuned independently for light and dark themes.

The app shows each operation's saved log path. Examples: Stable checks go to `logs/nix/stable-check/<session>.log`, Nix profile updates to `logs/nix/profile-apps/<session>.log`, KDE refreshes to `logs/nix/kde-refresh/<session>.log`, and module checks/applications to `logs/verify/modules/<module>/` or `logs/apply/modules/<module>/`. **Verify** and **History** can read the last 50 saved operation summaries and open an individual log by generated operation ID; the bridge never accepts an arbitrary file path from the browser. A fresh release starts with no operation logs, so the Stable status is initially **Not checked**. After a check, **Home** restores the last Stable result from `logs/nix/stable-check/`. The `.log` files are private to the local user and kept under the release-version state directory. See the Portuguese [system verification and log guide](docs/verificacao-e-logs.md) for the full tree and legacy-log behavior.

The top-bar language selector displays **BR** for Portuguese brasileiro and **US** for English (United States). The selection remains accessible and is saved locally in the browser for the next launch. The localized interface uses five destinations — **Home** (Início), **Verify** (Verificar), **Apply** (Aplicar), **Nix**, and **History** (Histórico). Home explains the tool's scope and presents the date/time of the last Stable-channel verification, the latest Stable version reported by the official source, the current status, and an **Open log** action when a saved check log exists.

The current system-terminal integration supports Konsole, xterm and XFCE Terminal. On a
desktop without one of these, operations requiring that terminal are blocked with an error;
read-only diagnostics can still use the browser window.

**Undo/rollback is not yet implemented.** The current backend roles do not save a complete pre-Apply snapshot, so this release cannot safely promise to return an already-modified system to its exact prior state. Do not infer package removals or alter swap/hibernation/GRUB state automatically. Use a VM/hypervisor snapshot to return to a known baseline; a future per-module undo must be snapshot-based, drift-checked and previewed before confirmation.

The session token is stored in a user-private file and is not passed in the
browser URL, browser process arguments or frontend JavaScript. The local page
receives it as an `HttpOnly; SameSite=Strict` cookie.

If backend prerequisites such as `make` or Ansible are missing, the application
prepares them in that system terminal before running a privileged operation.
Read-only diagnostics stay in the app window and never request a password.

Before installing Nix packages, the backend checks that the configured channel
was actually downloaded to the user's profile. If a previous channel update
failed after its URL was saved (for example, because the VM clock caused a TLS
certificate error), the next Apply retries the download instead of proceeding
to a later `nixpkgs.<package> not found` failure.

The current `doas` flow intentionally keeps administrator authentication in the system terminal; it does not bypass the password or create a broad `nopass` rule. Installing a KDE Polkit agent alone does not turn `doas` prompts into graphical dialogs. A terminal-free authorization flow would require a fixed, root-owned helper and a narrowly scoped Polkit action; it is not included in alpha.37.

The **Apply** destination offers **Preview configuration**, which runs the
backend `make simular` target (`ansible-playbook --check --diff`). This is a
best-effort preview, not a guarantee: Ansible tasks without check-mode support
may be skipped. If `make`, Ansible, the collection or prepared release-local
state is missing, the preview is blocked rather than installing prerequisites.
Review the full output in the system terminal and use a VM snapshot; Apply
still requires a separate explicit confirmation.

**Apply module** is disabled until that module has a recent valid live
diagnostic (not `unknown`) and every declared dependency has a recent `complete` diagnostic.
The module's component checks (for example, PipeWire and WirePlumber) are displayed in **Verify** with their status and message, so missing packages or configuration are visible; Apply module can repair those gaps once prerequisites are ready. Use Verify to run individual diagnostics or check every module, and use History to review persistent operation history. The module diagnostic's dependency declaration must also match the live catalog. The backend and UI enforce this gate; an `unknown` module status is not treated as success. A check older than 10 minutes expires and must be rerun. **Apply all modules** is available only from Apply and still requires the explicit confirmation gate.

Stable migration is enabled only after a successful check of the official Nix
Stable source reports `update_available`. Both UI and bridge require the result
to be no older than 10 minutes; another check or system-changing operation
invalidates it. **Validate again** refreshes bridge health and module catalog
after a successful integrity recheck, without requiring a browser restart. Home continues to display the last saved Stable result as history, but that saved result alone never authorizes a migration; run a fresh check in the current bridge process first.

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
`RELEASE-VERSIONS`. The alpha.37 test package uses backend candidate `v1.44-dev`
from branch `fix/one-shot-doas-authorization`, pinned to commit
`52712cb7872792c04495d8b63d1a917a35861e31`. This is a development candidate,
not an official backend release; the packager rejects a different SHA for this
pin. The old v1.43 pin is retained only for historical reproducibility.

```sh
sh scripts/package-portable.sh 0.1.0-alpha.37-web v1.44-dev
```

The resulting archive contains `frontend/`, `server/` and `backend/` in one
self-contained directory. To package a local backend checkout instead of
cloning the official tag, set `BACKEND_SOURCE`:

```sh
BACKEND_SOURCE=/path/to/alpine \
  sh scripts/package-portable.sh 0.1.0-alpha.37-web v1.44-dev
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
