# CareFinder — Hospital Management System (Frontend)

A calm, hospital-themed **responsive** website that helps users find **nearby hospitals** and shows **bed availability**.

## What this includes

- **Use current location** (browser geolocation) or **choose a location** (search + suggestions)
- **Nearby hospitals** fetched from OpenStreetMap (Overpass API)
- **Distance + map markers** (Leaflet)
- **Bed availability** shown as a **demo estimate** by default, with a hook for your real HMS backend
- Fully responsive layout: cards, filters, buttons, and map

## Run it

Option A (simplest): open `index.html` in your browser.

Option B (recommended): run a local server to avoid any browser restrictions:

```bash
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Backend (Node/Express)

This project includes a minimal backend for:

- **Admin login & registration** for hospital staff
- **Per-hospital bed management**
- **Public bed availability API** consumed by the frontend

### Install dependencies

```bash
cd "MInor Project"
npm install
```

### Start the backend

```bash
npm start
```

This runs the backend at `http://localhost:4000`.

- Healthcheck: `GET http://localhost:4000/health`
- Public bed API (used by `app.js`): `POST http://localhost:4000/api/bed-availability`
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/me`
- Hospital admin: `/api/hospitals/mine`, `/api/hospitals/mine/beds`

### Admin portal (hospital staff)

Use `admin.html` for hospital staff:

- Open `admin.html` in your browser (or via local server).
- Default seeded credentials for **KIMS**:
  - **Hospital**: `Pradyumna Bal Memorial Hospital (Kalinga Inst Of Medical hospital)`
  - **Email**: `kiims.admin@example.com`
  - **Password**: `Kiims@123`
- After login, you can:
  - View the linked hospital record
  - Update **capacity**, **available beds**, **ICU beds**, and **emergency** flag

When the backend is running, `index.html` will:

- Call `POST /api/bed-availability` with the list of hospitals from OpenStreetMap (India area)
- Overlay **real bed data** from hospitals that have admin-managed records (e.g., KIMS)
- Fall back to the **demo estimator** for all other hospitals

## Notes

- Hospital POIs: OpenStreetMap `amenity=hospital` within your chosen radius.
- Bed availability is **not real** until you connect your backend:
  - In `app.js`, set:
    - `BACKEND.enabled = true`
    - `BACKEND.endpoint = "https://your-backend/api/bed-availability"`
  - Backend should accept:
    - `POST /api/bed-availability`
    - Body: `{ "hospitals": [{ "id": "node/123", "lat": 19.076, "lon": 72.8777 }, ...] }`
  - Backend should return either:
    - `{ "bedsById": { "node/123": { "available": 12, "capacity": 40, "icu": 4, "emergency": true }, ... } }`
    - or
    - `{ "beds": [{ "id": "node/123", "available": 12, "capacity": 40, "icu": 4, "emergency": true }, ...] }`
  - Any hospital without backend data will fall back to the **demo estimator**.

