# Screenshot Index

These screenshots support quick reviewer scanning of the GigEze working demo scaffold. They should be refreshed when the main product flows or visual identity change.

| Image | Route | Demonstrates | Notes |
| --- | --- | --- | --- |
| [public-homepage.png](screenshots/public-homepage.png) | `/` | Public product positioning and backstage/live-gig brand system. | Captured from local development with the poster-style hero visible. |
| [dashboard-command-centre.png](screenshots/dashboard-command-centre.png) | `/dashboard` | Authenticated command-centre shell, trip sync entry point, and shared dashboard UI primitives. | Shows local seeded admin workspace. |
| [tours-board.png](screenshots/tours-board.png) | `/dashboard/tours` | Tour and gig workflow surface: active tour, visibility, progress, and operational actions. | Uses the GigEze seed tour, `East Coast Launch Run`. |
| [public-tours.png](screenshots/public-tours.png) | `/tours` | Public tour listing backed by published tour records. | Shows public-facing read path, not a production marketplace claim. |
| [workspace-settings.png](screenshots/workspace-settings.png) | `/dashboard/settings` | Workspace identity, default visibility, and GPS sampling configuration. | Useful for explaining how demo defaults support backstage workflows. |

## Updating Screenshots

- Keep filenames lowercase kebab-case.
- Store README screenshots in `docs/screenshots/`.
- Prefer route-based names such as `tour-detail.png`, `trip-sync.png`, or `mobile-trip-capture.png`.
- Keep captions focused on engineering and product value, not just visual style.
