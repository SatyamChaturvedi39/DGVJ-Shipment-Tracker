# Digvijay BLR — Project Memory for Claude

This file gives Claude full context to resume work across sessions and accounts.

---

## What this app is

**Digvijay BLR** — a production-grade shipment tracking mobile app for **Digvijay Express**, a logistics company in Bengaluru that ships goods between states via air and train.

**App name shown to users:** Digvijay BLR
**Repo:** C:\SattyGithub\DGVJ-Shipment-Tracker
**Owner:** Satyam (building this for the company)

---

## Three roles in one app

| Role | Who | Access |
|------|-----|--------|
| Admin | Branch manager (single user) | Create shipments, assign employees, trigger phase transitions, view all shipments |
| Employee | Drivers/delivery staff | See assigned jobs, share live GPS, confirm pickup/delivery |
| Customer | B2B clients | See only their shipments, track live GPS during pickup/delivery, status timeline |

Auth: Firebase Phone OTP for all roles. No passwords. Role is stored in the DB against the phone number.

---

## Tech stack (confirmed, do not change)

| Layer | Technology |
|-------|-----------|
| Frontend | React Native, Expo SDK 54, TypeScript, Expo Router |
| Auth | Firebase Phone OTP — **Firebase JS SDK v9 (modular)**, NOT @react-native-firebase |
| Backend | FastAPI (Python) |
| Database | PostgreSQL via Supabase (free tier) |
| Real-time GPS | WebSockets |
| Maps | react-native-maps + Google Maps API |
| Hosting | Render.com (backend) + Supabase (DB) |

**Why Firebase JS SDK instead of @react-native-firebase:** Works in Expo Go without native builds, faster dev iteration.

---

## Key constraints (never violate)

- **Free tier only** — Supabase free, Render free, Firebase free
- **Professional B2B UI** — Delhivery/BlueDart level polish
- **No email lock-in** — GitHub, Supabase, Render not tied to any specific email
- **India-only phone numbers** — +91 prefix hardcoded on login screen
- **`npm install` must use `--legacy-peer-deps`** — firebase/supabase conflict with React 19

---

## Database schema

```sql
users:               id, phone, name, role, company_name, firebase_uid, created_at
shipments:           id, tracking_id, status, current_phase, pickup_employee_id,
                     delivery_employee_id, transport_mode, transport_number,
                     origin, destination, eta_date, eta_time, notes,
                     created_at, completed_at
shipment_permissions: shipment_id, customer_user_id
location_updates:    id, shipment_id, employee_id, lat, lng, timestamp
status_events:       id, shipment_id, label, description, timestamp, is_completed
companies:           id, name, contact_phone
```

---

## Shipment phase logic

`current_phase` field drives what the customer sees:

| Phase | Customer map shows | GPS source |
|-------|--------------------|------------|
| pickup | Live map | Employee 1 (pickup driver) |
| transit | Static card: transport number + manual updates | None |
| delivery | Live map | Employee 2 (delivery driver) |
| completed | Summary | None |

Admin manually triggers phase transitions.

---

## Color palette (constants/colors.ts)

```
primary:         #C62828  (deep red — Digvijay brand, buttons, badges, tab active)
primaryDark:     #8E0000  (darker red — pressed states)
primaryLight:    #FF5F52  (lighter red — accents)
background:      #FFFFFF
surface:         #F5F5F5
surfaceElevated: #FFFFFF  (tab bars, cards)
textPrimary:     #1A1A1A
textSecondary:   #757575
textOnPrimary:   #FFFFFF  (text on red backgrounds)
success:         #2E7D32
warning:         #F57F17
error:           #C62828
border:          #E0E0E0
darkHeader:      #1A1A2E  (header bars only — all three role layouts)
textMuted:       #757575  (alias for textSecondary)
inputBg:         #F5F5F5  (alias for surface)
```

---

## Folder structure

```
app/
  _layout.tsx              # Root layout — wraps app in AuthProvider
  index.tsx                # Entry — redirects based on auth + role
  auth/
    _layout.tsx            # Auth stack (no header)
    login.tsx              # Phone input + "Digvijay BLR" branding + dev role selector
    verify.tsx             # OTP input (6 boxes) + resend timer
  (admin)/
    _layout.tsx            # Admin tab navigator (auth guard: role === 'admin')
    dashboard.tsx
    create-shipment.tsx
    archive.tsx
  (employee)/
    _layout.tsx            # Employee tab navigator (auth guard: role === 'employee')
    my-jobs.tsx
  (customer)/
    _layout.tsx            # Customer tab navigator (auth guard: role === 'customer')
    my-shipments.tsx
components/
  ui/
    Button.tsx             # primary/secondary/outline/danger variants, 52px height
    Input.tsx              # labeled input with error state, prefix support
    OTPInput.tsx           # 6 digit boxes, hidden TextInput underneath
    Card.tsx               # white surface, shadow, 16px radius
    LoadingSpinner.tsx     # centered ActivityIndicator
  PlaceholderScreen.tsx    # role badge + screen name + sign out (used until real screens built)
services/
  firebase.ts              # Firebase init with AsyncStorage persistence
  auth.ts                  # sendOTP, verifyOTP, signOut + DEV_MOCK_AUTH
  api.ts                   # Axios instance with token interceptor
context/
  AuthContext.tsx           # user, isLoading, login, verifyOTP, logout, setDevRole
hooks/
  useAuth.ts               # useContext(AuthContext) wrapper
types/
  index.ts                 # User, UserRole, Shipment, ShipmentPhase, StatusEvent, LocationUpdate
constants/
  colors.ts                # Color palette (see above)
  config.ts                # API_BASE_URL, DEV_MOCK_AUTH flag
backend/
  main.py                  # FastAPI app with CORS
  requirements.txt
  models/
    user.py                # UserBase, UserCreate, UserResponse (Pydantic)
    shipment.py            # ShipmentBase, ShipmentCreate, ShipmentResponse
  routes/
    auth.py                # POST /auth/verify-token (mock for now)
    users.py               # GET /users/me (mock for now)
  websocket/
    handler.py             # Placeholder for GPS WebSocket (Phase 2)
```

---

## Dev mode

`constants/config.ts` exports `Config.DEV_MOCK_AUTH = __DEV__`.

When enabled:
- Login screen shows "DEV MODE — Select Role" buttons at the bottom
- Tapping Admin/Employee/Customer bypasses OTP and logs in immediately
- OTP flow still works: any phone + code `123456` succeeds
- API calls use `http://localhost:8000`

**Do not remove dev mode** — it's essential for building UI without a real Firebase project.

---

## 6-phase build plan

| Phase | Status | What |
|-------|--------|------|
| 1 | ✅ DONE | Project setup, Firebase OTP auth, role-based navigation skeleton |
| 2 | ⬜ NEXT | FastAPI backend, Supabase schema, all API endpoints, WebSocket server |
| 3 | ⬜ | Admin dashboard screens |
| 4 | ⬜ | Employee screens + live GPS |
| 5 | ⬜ | Customer screens + tracking UI |
| 6 | ⬜ | Polish, testing, deployment |

---

## What's real vs placeholder (as of Phase 1)

| Thing | State |
|-------|-------|
| Firebase config in services/firebase.ts | Placeholder keys — needs real Firebase project |
| /auth/verify-token backend route | Returns mock user — needs Supabase integration |
| /users/me backend route | Returns mock user — needs Supabase integration |
| All role screens (dashboard, jobs, shipments) | PlaceholderScreen component |
| react-native-maps | Installed but not yet used |
| WebSocket | Handler file exists, no implementation |

---

## How to run

**Frontend:**
```bash
cd C:/SattyGithub/DGVJ-Shipment-Tracker
npx expo start
# Scan QR with Expo Go on Android
# Use Dev Mode role selector to bypass OTP
```

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# Docs at http://localhost:8000/docs
```

**Installing new packages:**
```bash
# Expo-managed packages:
npx expo install <package>

# Other npm packages:
npm install <package> --legacy-peer-deps
```
