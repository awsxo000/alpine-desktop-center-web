# Changelog

## Web era — 0.1.0-alpha.1

This release establishes the browser-first line of Alpine Desktop Center.

- Added a browser installer flow inspired by system installers.
- Added explicit steps for welcome, backend validation, system checks, modules, configuration, execution and summary.
- Added local-only launcher support with a Python HTTP server bound to `127.0.0.1`.
- Added embedded backend manifest validation through the local bridge.
- Added a portable two-click package layout without external hosting.
- Preserved the backend as the source of truth and kept arbitrary shell execution out of the browser contract.
