# Changelog

## 0.1.0-alpha.4

The local bridge now executes the real v1.43 backend targets through a closed allowlist: structured module diagnostics, Stable Nix channel checks/migration, Nix application updates, full Apply, diagnostic Apply and module Apply. Every command is revalidated against the embedded SHA-256 manifest immediately before execution, and output is saved inside `.alpine-state/web/operations/`. The unused profile avatar was removed.

## 0.1.0-alpha.3

This revision replaces the previous improvised palette with the user's Rokko visual reference: light gray workspace surfaces, white content panels, deep institutional green navigation, vivid green selection states, dark readable typography and restrained borders. Agama/openSUSE remains a structural reference for clarity, not a color or branding reference.

## 0.1.0-alpha.2

This iteration makes the local browser UI behave like a dedicated installer window rather than a normal browser tab. The launcher uses an isolated Chromium app window or Firefox kiosk mode, blocks future installer steps until the current step is completed, and corrects the light theme surfaces and visual hierarchy.

## Web era — 0.1.0-alpha.1

This release establishes the browser-first line of Alpine Desktop Center.

- Added a browser installer flow inspired by system installers.
- Added explicit steps for welcome, backend validation, system checks, modules, configuration, execution and summary.
- Added local-only launcher support with a Python HTTP server bound to `127.0.0.1`.
- Added embedded backend manifest validation through the local bridge.
- Added a portable two-click package layout without external hosting.
- Preserved the backend as the source of truth and kept arbitrary shell execution out of the browser contract.
