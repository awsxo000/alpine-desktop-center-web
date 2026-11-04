# UI direction references

The redesign follows the interaction model, not the branding, of two installer projects:

- [Rokko institucional](https://rokko-institucional.pages.dev/) — the user's visual reference and the source for the light gray canvas, white surfaces, deep green identity and vivid green action state now used by Alpine Desktop Center.

- [Agama project](https://agama-project.github.io/) — a service-based installer with a modern web UI, a first-class CLI and an HTTP API. This supports keeping Alpine Desktop Center's web UI local while preserving a separate execution bridge.
- [SUSE Agama automated installation](https://documentation.suse.com/sles/16.0/html/SLES-x86-64-agama-automated-installation/index.html) — documents the service/API/profile model and the separation between the client and the installation service.
- [Fedora Magazine: Reimagining the Anaconda installer](https://fedoramagazine.org/anaconda-installer-redesign/) — describes the move from a hub-and-spoke layout to a guided linear experience with good defaults, a review page and a clear task-oriented flow. It also notes that Anaconda renders its local web UI in a dedicated local browser process rather than Electron.

Applied decisions for Alpine Desktop Center:

1. The launcher uses an isolated Chromium app window when available, with a Firefox kiosk fallback, instead of `xdg-open`.
2. The browser profile is isolated inside `.alpine-state/web`, so the application does not reuse the user's normal browser session.
3. The UI keeps a linear step flow and makes future steps unavailable until the current step is complete or explicitly inspected.
4. The local Python service remains the execution authority; the browser is only its controlled client.
