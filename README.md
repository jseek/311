# Nearby 311 Issues

A small, static web app that shows nearby 311 issues on a Leaflet map and lists issues within 2,000 feet of your current location (or a Tacoma, WA fallback).

## Features

- Uses browser geolocation with a Tacoma, WA default fallback.
- Filters by issue status (open, acknowledged, closed, archived).
- Lists nearby issues and links to per-issue detail pages.
- Draws issue markers and a radius ring on an OpenStreetMap/Leaflet map.
- Fetches data from the SeeClickFix API.

## Getting started

This project is plain HTML/CSS/JS, so you can run it with any static file server.

### Option 1: Open directly

Open `index.html` in a browser. (Some browsers restrict geolocation on `file://` URLs; if so, use a local server.)

### Option 2: Use a simple local server

With Python installed:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/index.html`.

## Project structure

- `index.html`: main map + list view.
- `app.js`: map creation, geolocation, filtering, and issue list rendering.
- `issue.html`: issue detail page.
- `issue.js`: fetches and renders details for a single issue.
- `styles.css`: shared styles.

## Data source

Issues are loaded from the public SeeClickFix API:

- Issue list: `https://seeclickfix.com/api/v2/issues` (filtered by bounding box + status)
- Issue details: `https://seeclickfix.com/api/v2/issues/{id}?details=true`

## Notes

- Geolocation requires HTTPS or `localhost`.
- Status filters reload the map and list for the current location.
