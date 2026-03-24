# 🎺 Waterloo Band — Request Portal

A lightweight, self-contained request portal for the Waterloo School District band program. Students and parents can submit instrument repair requests and materials requests, and the director can manage them through a built-in dashboard.

## Features

- **Instrument Repair Requests** — Students/parents describe the issue, select severity, and specify instrument details including ownership (personal vs. school-owned)
- **Materials Requests** — Quick chip-select for common items (reeds, valve oil, sticks, etc.) with an option to add custom items
- **Director Dashboard** — Filter by status (Open, In Progress, Done, Sent Out) and type, with KPI cards at a glance
- **Ticket Detail Modal** — Update status, set pickup location, send quick-reply messages, and track reply history
- **Wait-Time Estimate** — Dynamic banner showing estimated turnaround based on open ticket count
- **100% Client-Side** — All data stored in `localStorage`. No server, no database, no accounts required.

## Usage

This is a single HTML file with no dependencies. You can:

1. **Open it directly** — Double-click `index.html` in any modern browser
2. **Host via GitHub Pages** — Enable Pages on this repo (Settings → Pages → Source: main branch) and it's live
3. **Embed in an LMS** — Drop the file into Google Sites, Schoology, or any platform that accepts HTML

## Tech

- Vanilla HTML / CSS / JavaScript
- No frameworks, no build step
- Data persists in the browser's `localStorage` (per-device)

## Screenshot

> _Maroon & Gold Waterloo Warriors theme_

## License

MIT
