# Digvijay BLR — Shipment Tracking App

> Production-grade mobile shipment tracking for **Digvijay Express**, a logistics company based in Bengaluru that ships goods between states via air and train.

![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_54-0EA5E9?logo=expo)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?logo=android)

---

## What It Does

Digvijay BLR is a closed B2B tracking app with three roles:

| Role | Who | What They Can Do |
|------|-----|-----------------|
| **Admin** | Branch manager | Create shipments, assign drivers, advance phases, add status updates, manage team |
| **Employee** | Pickup & delivery drivers | View assigned jobs, share live GPS location, confirm phase transitions |
| **Customer** | B2B clients | Track their shipments in real-time — live map, phase timeline, ETA |

### Shipment Lifecycle
```
Pickup → In Transit → Handed to Carrier → Out for Delivery → Completed
```
- Employee 1 (pickup driver) handles phases 1–2 with live GPS
- Employee 2 (delivery driver) handles phases 4–5 with live GPS
- Phase 3 shows transport info (flight/train number) to customers
- Admin can force-advance any phase as a failsafe

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native, Expo SDK 54, TypeScript, Expo Router |
| Auth | Phone + 4-digit PIN (JWT via PyJWT, stored in AsyncStorage) |
| Backend | FastAPI (Python 3.11+) |
| Database | PostgreSQL via Supabase |
| Real-time | WebSockets (FastAPI + asyncio) |
| Maps | react-native-maps (Google Maps SDK) |
| Routing/ETA | OpenRouteService API (free tier) |
| Hosting | Render.com (backend) + Supabase (database) |

---

## Screenshots

> *Screenshots to be added after production APK build.*

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- Expo Go app on your Android device (for development)
- Supabase project (free tier)

### Frontend

```bash
# Clone the repo
git clone https://github.com/SatyamChaturvedi39/DGVJ-Shipment-Tracker.git
cd DGVJ-Shipment-Tracker

# Install dependencies
npm install --legacy-peer-deps

# Copy env template and fill in your values
cp .env.example .env

# Start the dev server
npx expo start --clear
```

Scan the QR code with Expo Go on your Android device.

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy env template and fill in your values
cp .env.example .env

# Start the server
uvicorn main:app --reload

# API docs available at:
# http://localhost:8000/docs
```

---

## Environment Variables

### Frontend (`.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend URL for dev (e.g. `http://localhost:8000`) |
| `EXPO_PUBLIC_PROD_API_URL` | Backend URL for production builds |
| `EXPO_PUBLIC_DEV_MOCK_AUTH` | Set `true` to bypass PIN auth in dev |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps SDK key (free, needed for map tiles in APK) |
| `EXPO_PUBLIC_ORS_API_KEY` | OpenRouteService key (free, for route polyline + ETA) |

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (keep secret) |
| `JWT_SECRET_KEY` | Random 32+ character string for signing JWTs |
| `ENVIRONMENT` | Set `production` on Render to enable security headers |

---

## Database Setup

Run the following in your Supabase SQL editor:

```sql
-- Run migrations in order
-- See backend/migrations/001_initial.sql for the full schema

-- Required additions if upgrading from an earlier version:
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE status_events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 99;
```

---

## Deployment

### Backend — Render.com

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service → connect repo
3. Set **Root Directory** to `backend`
4. Add environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET_KEY`, `ENVIRONMENT=production`
5. Deploy — live at `https://your-service.onrender.com`

### Frontend — EAS Build (Android APK)

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Set production env vars in .env:
# EXPO_PUBLIC_PROD_API_URL=https://your-render-url.onrender.com
# EXPO_PUBLIC_DEV_MOCK_AUTH=false

# Build preview APK (sideloadable on any Android device)
eas build --profile preview --platform android
```

---

## Project Structure

```
app/
  auth/          # Login + PIN entry screens
  (admin)/       # Admin dashboard, shipment management, team
  (employee)/    # My Jobs, job detail with GPS tracking
  (customer)/    # My Shipments, live tracking, profile
backend/
  routes/        # FastAPI route handlers
  models/        # Pydantic request/response models
  websocket/     # WebSocket connection manager
  migrations/    # SQL migration files
components/ui/   # Reusable Button, Input, Card components
services/        # API client, auth helpers
constants/       # Colors, config, phase definitions
```

---

## Development Notes

- **Dev mode**: Set `EXPO_PUBLIC_DEV_MOCK_AUTH=true` → role selector buttons appear on login screen — tap Admin/Employee/Customer to bypass PIN auth
- **Package installation**: Always use `npm install --legacy-peer-deps` (Supabase/React 19 conflict)
- **Expo packages**: Use `npx expo install <pkg> -- --legacy-peer-deps`
- **Backend cold starts**: Render free tier sleeps after 15 min of inactivity — first request takes ~30s

---

## License

Private — all rights reserved. Built for Digvijay Express, Bengaluru.
