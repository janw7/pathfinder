
# Pathfinder — Fleet Dispatch & Carbon Footprint Tracker

Pathfinder is a B2B web application for fleet dispatchers to plan, optimize, and track multi-stop courier routes — with built-in CO₂ emission accounting per vehicle class.

Unlike consumer mapping tools (e.g., Google Maps), Pathfinder is designed around **fleet operations**: dispatchers manage reusable route history, compare emissions across vehicle types (combustion vs. electric cars, vans, and trucks), and persist fleet defaults — turning routing from a one-off lookup into an auditable operational record.

## Live Demo



https://github.com/user-attachments/assets/0da14527-fcaf-4a3e-9a86-24bb590fab42



## Key Features

- **Multi-stop route planning** — dynamic waypoint timeline with unlimited stopovers between start and end
- **Real road geometry snapping** — routes rendered via OSRM follow actual roads, not straight lines
- **CO₂ calculation by vehicle class** — emission factors for combustion/electric cars, vans, and light/heavy trucks
- **Persistent default vehicle** — `localStorage`-backed fleet default with one-click "Set as Default"
- **Full CRUD route management** — create, recalculate (vehicle swap), view on map, and delete saved routes
- **Interactive map dashboard** — Leaflet map with waypoint markers, road-snapped polylines, and auto-fitting bounds
- **Fleet KPI strip** — live totals for active routes, distance, and tracked CO₂ footprint

## Tech Stack

| Layer    | Technologies |
|----------|--------------|
| Frontend | React 19, Vite, Tailwind CSS 3.4, Leaflet / React-Leaflet, lucide-react |
| Backend  | Python, FastAPI, SQLAlchemy, SQLite, httpx |
| APIs     | OpenStreetMap Nominatim (geocoding), OSRM (routing & road geometry) |

## Getting Started

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000` (docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App will be available at `http://localhost:5173`.

## AI-Assisted Development Workflow

This project was built using an AI-assisted workflow (LLM-based pair programming and coding agents) to accelerate development while maintaining full architectural control:

- **Architecture & Scaffolding:** Used AI to brainstorm the B2B feature scope, design the REST API contract, and scaffold boilerplate for FastAPI endpoints and Tailwind CSS dashboard components.
- **API Integration & Debugging:** Leveraged AI to troubleshoot external API quirks — specifically handling OpenStreetMap, converting coordinate formats between OSRM and Leaflet, and configuring CORS middleware.
- **Code Review & Quality Assurance:** Every AI-generated module was manually reviewed, simplified to avoid over-engineering, and verified end-to-end through testing (macOS and Windows).

> **Note:** route calculation makes live calls to the public Nominatim/OSRM APIs and respects Nominatim's 1 request/second rate limit, so multi-stop routes take a few seconds to compute.
