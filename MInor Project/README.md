# CareFinder • Hospital & Ambulance Platform

CareFinder is an India-focused Hospital Management System (HMS) demo that connects patients with nearby hospitals, real-time bed availability, and emergency ambulance services. Built as a campus minor project, it demonstrates modern web technologies for healthcare discovery.

---

## Table of Contents

- [Features Overview](#features-overview)
- [Quick Start](#quick-start)
- [Project Structure & File Concepts](#project-structure--file-concepts)
- [Detailed Feature Documentation](#detailed-feature-documentation)
- [Tech Stack](#tech-stack)

---

## Features Overview

| Feature | Description |
|---------|-------------|
| **Hospital Finder** | Search hospitals across India using location or city/area, with map view, filters (radius, min beds, sort), and live OpenStreetMap data |
| **Map Thumbnails** | Each hospital card displays a small map-based thumbnail showing the hospital's location (OSM tiles, lazy-loaded) |
| **Bed Availability** | View available beds, capacity, ICU count, and emergency status; integrates with backend or uses demo estimates |
| **Bed Categories & Pricing** | Detailed breakdown (General Ward, Semi-Private, ICU, NICU, etc.) with indicative pricing per category |
| **Medical Tests & Facilities** | Hospital-specific diagnostic tests, imaging, and medical facilities with pricing and relevant images |
| **Hospital Detail Page** | Full profile with photos, facilities, bed table, contact info, and embedded map |
| **Emergency Ambulance** | Request BLS/ALS/ICU/Neonatal ambulances with live vehicle tracking and 10-minute arrival target |
| **Ambulance Status Popups** | Sequential notifications: "Dispatching an ambulance for you" → "Ambulance is on its way" → "Ambulance has arrived" |
| **Staff Portal** | Hospital staff can register, log in, and update bed availability in real time |
| **India-Only Geofencing** | Location search and "Use my location" restricted to India using Nominatim and bounding-box checks |

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the backend server (required for bed availability + ambulance)
npm start

# Open in browser (serve the folder, e.g. via VS Code Live Server or http-server)
# Backend: http://localhost:4000
# Frontend: Open index.html or serve the folder
```

**Default KIMS admin credentials:** `kiims.admin@example.com` / `Kiims@123`

---

## Project Structure & File Concepts

### Frontend (HTML)

| File | Purpose & Concepts |
|------|-------------------|
| **index.html** | Landing page. Hero section with image carousel, feature cards (Hospital finder, Ambulance, Staff portal), About section. Uses Tailwind CSS (CDN). |
| **hospitals.html** | Hospital finder page. Search sidebar (location, radius, min beds, sort), map container, results grid. Integrates Leaflet for map. |
| **hospital.html** | Hospital detail page. Header, photo gallery, about section, bed table, contact & location, embedded map. Receives hospital data via `localStorage` from hospitals list. |
| **ambulance.html** | Ambulance booking page. Pickup form, ambulance type selection (BLS/ALS/ICU/Neonatal), live map, tracking panel, nearest hospitals list. Includes status toast and confirmation modal. |
| **admin.html** | Staff portal. Login form, registration form, bed management dashboard. JWT-protected API calls. |
| **privacy.html** | Privacy policy. |
| **terms.html** | Terms and conditions. |

### Frontend (JavaScript)

| File | Purpose & Concepts |
|------|-------------------|
| **app.js** | Hospital finder logic. **Concepts:** Overpass API for OSM hospital queries, Nominatim geocoding, haversine distance, debounced search, demo/deterministic bed availability (mulberry32 PRNG), bed categories builder, backend bed-availability integration, map markers, card rendering with **map thumbnails** (OSM tile URL from lat/lon), filter/sort pipeline. |
| **hospital.js** | Hospital detail logic. **Concepts:** `localStorage` for passing selected hospital, Leaflet map init, bed table builder, facilities list, **medical tests & facilities with pricing**, photo assignment (hash-based from hospital id). |
| **ambulance.js** | Ambulance flow. **Concepts:** Leaflet map, pickup pin, Overpass for nearby hospitals, geocoding drop hospital, API request/track, **toast popup sequence** (Dispatching → On its way → Arrived), polling for live ambulance position, route polyline. |
| **landing.js** | Hero carousel, dot navigation, auto-advance, footer year. |
| **navigation.js** | Slide-in drawer (hamburger menu), overlay, Escape key close. Shared across pages. |

### Backend

| File | Purpose & Concepts |
|------|-------------------|
| **server.js** | Express REST API. **Concepts:** CORS, JSON body parser, JWT auth middleware, bcrypt password hashing, file-based JSON persistence (`backend-data.json`), hospital name matching (normalization, aliases), bed PATCH, public bed-availability POST, **ambulance request** (in-memory trips, jittered pickup, ETA simulation), **ambulance track** (progress interpolation, status `en_route` → `arrived`). |

### Data Flow

- **Hospitals:** Overpass (OSM) → app.js → (optional) backend `/api/bed-availability` → render cards
- **Hospital detail:** hospitals.html card click → `localStorage` + `hospital.html?id=...` → hospital.js reads, renders
- **Ambulance:** Form submit → POST `/api/ambulances/request` → GET `/api/ambulances/track/:id` (polling)
- **Staff:** Register → POST `/api/auth/register`; Login → POST `/api/auth/login` → JWT → PATCH `/api/hospitals/mine/beds`

---

## Detailed Feature Documentation

### 1. Hospital Finder

- **Location sources:** "Use my location" (Geolocation API) or text search (Nominatim, India-only).
- **Hospitals:** Fetched via Overpass API (`amenity=hospital`) within radius (2/5/10/15 km).
- **Filters:** Min available beds, sort by distance/beds/name.
- **Map:** Leaflet, OSM tiles; markers with popups; "Focus on map" per card.
- **Thumbnails:** Each card shows a small OSM map tile of the hospital location (zoom 16), lazy-loaded for performance.

### 2. Bed Availability & Categories

- **Backend integration:** Optional POST to `/api/bed-availability` with hospital list; returns `beds` (available, capacity, icu, emergency).
- **Demo mode:** Deterministic per-hospital values via `mulberry32(seed)` from OSM id.
- **Categories:** General Ward, Semi-Private, Private, ICU, NICU, Daycare with capacity, available, and indicative price.

### 3. Medical Tests & Facilities

- Each hospital profile includes:
  - **Medical tests** (e.g. CBC, Lipid Panel, X-Ray, MRI, ECG) with pricing (₹).
  - **Facilities** (Emergency, ICU, Radiology, Pathology, etc.) with brief descriptions.
  - **Relevant images** for diagnostics and facilities.

### 4. Ambulance Module

- **Types:** BLS, ALS, ICU on Wheels, Neonatal/Paediatric.
- **Pickup:** "Use my location" or tap on map.
- **Flow:** Request → "Dispatching an ambulance for you" toast → After ~3 s "Ambulance is on its way" → When backend marks `arrived`, "Ambulance has arrived" toast.
- **Tracking:** Poll `/api/ambulances/track/:id` every 5 s; ambulance marker moves along route; status and ETA displayed.

### 5. Staff Portal

- Registration with hospital details; auto-creates hospital if not found.
- Login returns JWT; dashboard loads hospital beds; staff can PATCH beds.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, Tailwind CSS (CDN), Vanilla JS |
| Maps | Leaflet, OpenStreetMap tiles |
| Geocoding / OSM | Nominatim, Overpass API |
| Backend | Node.js, Express |
| Auth | JWT, bcryptjs |
| Data | JSON file (`backend-data.json`) |

---

## License

MIT.
