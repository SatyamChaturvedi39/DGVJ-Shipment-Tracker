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
- **`npx expo install` syntax for Expo packages:** `npx expo install <pkg> -- --legacy-peer-deps`

---

## Database schema

```sql
users:               id, phone, name, role, company_name, firebase_uid, created_at
shipments:           id, tracking_id, status, current_phase, pickup_employee_id,
                     delivery_employee_id, transport_mode, transport_number,
                     origin, destination, eta_date, eta_time, notes, goods_description,
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

Phase order: `pickup → transit → delivery → completed`

- Admin triggers phase transitions from shipment-detail screen
- Employee triggers pickup→transit ("Mark as Picked Up") and delivery→completed ("Mark as Delivered") from job-detail screen
- **Backend note:** `PUT /shipments/{id}/phase` is currently admin-only in tracking.py. Employee phase transitions work in dev mode only (dev-mock-token returns admin). For production, backend needs `require_role("admin", "employee")`.

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

**Important:** Only use color keys that exist above. `Colors.accent` and `Colors.danger` do NOT exist — use `Colors.primary` and `Colors.error` respectively.

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
    dashboard.tsx          # ✅ Phase 3 — shipment list, stats, pull-to-refresh
    create-shipment.tsx    # ✅ Phase 3 — full form, train/air toggle, employee picker
    archive.tsx            # ✅ Phase 3 — completed shipments, search bar
    shipment-detail.tsx    # ✅ Phase 3 — detail view, timeline, phase transitions, status events
  (employee)/
    _layout.tsx            # Employee tab navigator (auth guard: role === 'employee')
                           #   — shows employee name in header right of My Jobs tab
    my-jobs.tsx            # ✅ Phase 4 — Active/Completed tabs, job cards, pull-to-refresh
    job-detail.tsx         # ✅ Phase 4 — route, goods, timeline, GPS tracking, phase actions
  (customer)/
    _layout.tsx            # Customer tab navigator (auth guard: role === 'customer')
    my-shipments.tsx       # ⬜ Phase 5 — currently PlaceholderScreen
components/
  ui/
    Button.tsx             # primary/secondary/outline/danger variants, 52px height
    Input.tsx              # labeled input with error state, prefix support
    OTPInput.tsx           # 6 digit boxes, hidden TextInput underneath
    Card.tsx               # white surface, shadow, 16px radius
    LoadingSpinner.tsx     # centered ActivityIndicator (uses Colors.primary)
  PlaceholderScreen.tsx    # role badge + screen name + sign out (used until real screens built)
services/
  firebase.ts              # Firebase init with AsyncStorage persistence
  auth.ts                  # sendOTP, verifyOTP, signOut + DEV_MOCK_AUTH
  api.ts                   # Axios instance with token interceptor + all API functions
                           #   — getIdToken() errors are caught in interceptor (won't crash)
                           #   — getShipments/getEmployees/getCustomers return ?? [] (null-safe)
context/
  AuthContext.tsx           # user, isLoading, login, verifyOTP, logout, setDevRole
hooks/
  useAuth.ts               # useContext(AuthContext) wrapper
types/
  index.ts                 # User, UserRole, Shipment, ShipmentDetail, ShipmentPhase, StatusEvent, LocationUpdate
constants/
  colors.ts                # Color palette (see above)
  config.ts                # API_BASE_URL, DEV_MOCK_AUTH, DEV_ROLE_SELECTOR flags
backend/
  main.py                  # FastAPI app with CORS (allow_origins=["*"])
  database.py              # Supabase client singleton
  dependencies.py          # get_current_user, require_role()
  requirements.txt
  .env                     # SUPABASE_URL, SUPABASE_SERVICE_KEY, FIREBASE_PROJECT_ID
  firebase-service-account.json  # gitignored — download from Firebase Console
  migrations/
    001_initial.sql        # Paste into Supabase SQL Editor to create all tables
  models/
    user.py                # UserResponse, UpdateProfileRequest
    shipment.py            # CreateShipmentRequest, UpdateShipmentRequest, etc.
  routes/
    auth.py                # POST /auth/verify-token
    users.py               # GET /users/me, PUT /users/me, GET /users/employees|customers
    shipments.py           # Full CRUD: POST/GET/GET{id}/PUT/DELETE /shipments
    tracking.py            # PUT /shipments/{id}/phase (admin-only), POST /shipments/{id}/status-event
                           # POST /location/update (employee-only), GET /location/{id}/latest
  websocket/
    manager.py             # ConnectionManager singleton — broadcast to shipment watchers
    handler.py             # WS /ws/{shipment_id} endpoint
```

---

## Dev mode

`constants/config.ts` controls dev mode via environment variables — **NOT hardcoded `__DEV__`**.

```ts
const mockAuthEnv = process.env.EXPO_PUBLIC_DEV_MOCK_AUTH;
const mockAuthEnabled = DEV && mockAuthEnv !== 'false';

export const Config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL ?? (DEV ? 'http://localhost:8000' : '...'),
  DEV_MOCK_AUTH: mockAuthEnabled,
  DEV_ROLE_SELECTOR: mockAuthEnabled,   // controls visibility of role buttons on login screen
};
```

**Critical:** Always use `Config.DEV_ROLE_SELECTOR` (not `__DEV__`) to gate dev-only UI. `__DEV__` is ALWAYS true in Expo Go regardless of env vars.

When dev mode is enabled (`EXPO_PUBLIC_DEV_MOCK_AUTH=true`, the default):
- Login screen shows "DEV MODE — Select Role" buttons at the bottom
- Tapping Admin/Employee/Customer bypasses OTP and logs in immediately
- OTP flow still works: any phone + code `123456` succeeds
- API calls use `http://localhost:8000`

**Do not remove dev mode** — it's essential for building UI without a real device.

### Dev mode behaviour per role (important for employee screens)

The backend `dependencies.py` maps `dev-mock-token` to **the first admin user in the DB**:
```python
if token == "dev-mock-token":
    result = supabase.table("users").select("*").eq("role", "admin").limit(1).execute()
```
This means:
- **All API calls in dev mode behave as admin**, regardless of which dev role the frontend selected
- `GET /shipments` → returns ALL shipments (admin path), not just assigned ones
- `PUT /shipments/{id}/phase` → works (admin-only endpoint, accepted)
- `POST /location/update` → **returns 403** (employee-only, admin user rejected)

**Consequence for employee screens:**
- `my-jobs.tsx` shows all shipments in dev mode (filtered by `Config.DEV_MOCK_AUTH` flag, not employee ID)
- `job-detail.tsx` skips `POST /location/update` in dev mode — GPS UI still works, coords update, but not sent to backend
- Phase transitions (Mark Picked Up / Mark Delivered) work in dev mode

**If dev mode admin user lookup fails (401 "No admin user found"):**
This means there is no user with `role = 'admin'` in the Supabase DB. Fix:
```sql
UPDATE users SET role = 'admin' WHERE phone = '+91XXXXXXXXXX';
```

### Environment variable reference (.env)

```
# Dev defaults (emulator / fast UI dev):
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_DEV_MOCK_AUTH=true

# Physical device testing (phone must share Wi-Fi with laptop):
EXPO_PUBLIC_API_URL=http://<YOUR_LAPTOP_LAN_IP>:8000
EXPO_PUBLIC_DEV_MOCK_AUTH=false
```

After changing `.env`, always restart with `npx expo start --clear` — env vars are inlined at bundle time.

---

## 6-phase build plan

| Phase | Status | What |
|-------|--------|------|
| 1 | ✅ DONE | Project setup, Firebase OTP auth, role-based navigation skeleton |
| 2 | ✅ DONE | FastAPI backend, Supabase schema, all API endpoints, WebSocket server |
| 3 | ✅ DONE | All 4 Admin screens (dashboard, create-shipment, archive, shipment-detail) |
| 4 | ✅ DONE | Employee screens (my-jobs, job-detail) + live GPS tracking |
| 5 | ✅ DONE | Customer screens + tracking UI (live map for pickup/delivery phases) |
| 6 | ⬜ NEXT | Polish, testing, deployment |

---

## Known issues / production gaps

### 1. Real OTP does not work on physical device
- **Root cause:** Firebase JS SDK's `fakeRecaptchaVerifier` only works with Firebase test phone numbers. Real phone numbers with real OTP require `@react-native-firebase` (native build) or a server-side SMS gateway.
- **Current workaround:** Use dev mode role selector (`EXPO_PUBLIC_DEV_MOCK_AUTH=true`) to bypass OTP entirely during development.
- **To fix for production:** Either (a) set up Firebase test phone numbers in Firebase Console for testing, or (b) switch to `@react-native-firebase` when doing a custom dev build (EAS Build).

### 2. New users are always created as 'customer' role
- **Root cause:** `backend/routes/auth.py` `POST /auth/verify-token` inserts all new users with `role: 'customer'` hardcoded.
- **To fix:** Manually update roles in Supabase SQL Editor: `UPDATE users SET role = 'admin' WHERE phone = '+91XXXXXXXXXX';`

### 3. Employee phase transitions are admin-only in backend
- **Root cause:** `PUT /shipments/{id}/phase` in `tracking.py` uses `require_role("admin")`.
- **Current state:** Works in dev mode (dev-mock-token → admin). Will return 403 for real employee users.
- **To fix for production:** Change `require_role("admin")` to `require_role("admin", "employee")` in `backend/routes/tracking.py`, and add access checks (employee must be assigned to the shipment).

### 4. `POST /location/update` skipped in dev mode
- **Root cause:** Requires employee role; dev-mock-token returns admin → 403.
- **Current state:** In `job-detail.tsx`, location updates are skipped when `Config.DEV_MOCK_AUTH` is true. GPS UI (watcher, coordinates display) works normally.
- **To fix for production:** No code change needed — real employee tokens will pass the role check.

### 5. `EXPO_PUBLIC_API_URL` must be set for physical device
- Phone cannot reach `localhost:8000` — must use laptop's LAN IP.
- Already handled by config.ts reading from env var.
- Action: Set in `.env` when testing on device, reset to `localhost:8000` for emulator dev.

### 6. Backend must bind to 0.0.0.0 for LAN access
- Default `uvicorn main:app --reload` binds to `127.0.0.1` (localhost only).
- For physical device testing: `uvicorn main:app --reload --host 0.0.0.0`

---

## What's real vs placeholder (as of Phase 4)

| Thing | State |
|-------|-------|
| Firebase config | Real keys in .env (EXPO_PUBLIC_FIREBASE_*) |
| Firebase Admin SDK | Needs firebase-service-account.json in /backend |
| All backend API endpoints | Fully implemented, connected to Supabase |
| WebSocket /ws/{shipment_id} | Fully implemented with ConnectionManager |
| Admin screens (all 4) | ✅ Fully implemented — Phase 3 complete |
| Employee my-jobs screen | ✅ Fully implemented — Phase 4 complete |
| Employee job-detail screen | ✅ Fully implemented — Phase 4 complete |
| Customer my-shipments screen    | ✅ Fully implemented — Phase 5 complete |
| Customer shipment-tracking screen | ✅ Fully implemented — Phase 5 complete |
| Customer profile screen         | ✅ Fully implemented — Phase 5 complete |
| expo-location | ✅ Installed (~19.0.8), plugin added to app.json |
| react-native-maps | ✅ Installed (SDK 54 compatible), plugin added to app.json |

---

## Key implementation notes (from Phase 3)

### Admin detail screen navigation (Expo Router v6)
`shipment-detail` lives as a hidden tab screen (not in the tab bar):
```tsx
<Tabs.Screen
  name="shipment-detail"
  options={{
    title: 'Shipment Details',
    href: null,                        // hides from tab bar
    tabBarStyle: { display: 'none' },  // hides tab bar when active
  }}
/>
```
Navigate to it via: `router.push('/(admin)/shipment-detail?id=${shipment.id}')`
Read the param via: `useLocalSearchParams<{ id: string }>()`

**Do NOT use `href` and `tabBarButton` together** — Expo Router v6 throws a render error.

### Phase badge colors
```
pickup:    bg #FFF8E1, text #F57F17  (amber)
transit:   bg #E3F2FD, text #1565C0  (blue)
delivery:  bg #FFF8E1, text #F57F17  (amber)
completed: bg #E8F5E9, text #2E7D32  (green)
```

---

## Key implementation notes (from Phase 4)

### Employee job-detail navigation (same pattern as admin shipment-detail)
`job-detail` is a hidden tab screen in `app/(employee)/_layout.tsx`:
```tsx
<Tabs.Screen
  name="job-detail"
  options={{
    title: 'Job Details',
    href: null,
    tabBarStyle: { display: 'none' },
  }}
/>
```
Navigate to it via: `router.push('/(employee)/job-detail?id=${shipment.id}')`

### Employee role determination
In `job-detail.tsx`, the employee's role (pickup vs delivery) is determined client-side:
```ts
const employeeRole: 'pickup' | 'delivery' =
  shipment?.delivery_employee_id === userId ? 'delivery' : 'pickup';
```
Defaults to 'pickup' when userId doesn't match (dev mode where userId = 'dev-user-1').

### GPS tracking in job-detail.tsx
- Uses `expo-location` — `Location.watchPositionAsync` with High accuracy, 5s interval, 10m distance
- GPS section only renders when `phase matches employeeRole` (pickup driver sees GPS during pickup phase, delivery driver during delivery phase)
- Location watcher is stored in `useRef<Location.LocationSubscription>` and cleaned up on unmount
- In dev mode: watcher runs but `POST /location/update` is skipped (403 prevention)
- Pulsing dot: `Animated.loop` on opacity 1→0.3→1 at 800ms, `useNativeDriver: true`

### my-jobs.tsx tab filtering
- Active tab: `current_phase === 'pickup' || current_phase === 'delivery'`
- Completed tab: `current_phase === 'completed'`
- Assignment filter: skipped in dev mode (`Config.DEV_MOCK_AUTH`), enforced in production
- Backend does server-side filtering for real employees (only returns assigned shipments)

### Employee name in header
In `app/(employee)/_layout.tsx`, the employee's name is shown in the My Jobs tab header via `headerRight`:
```tsx
headerRight: () => <EmployeeName name={user.name ?? 'Employee'} />,
```
The `user` object comes from `useAuth()` in the layout component (already read for auth guard).

---

## Key implementation notes (from Phase 5)

### Customer screen structure
- `app/(customer)/_layout.tsx` — 2 tabs (My Shipments, Profile) + `shipment-tracking` as hidden screen
- `app/(customer)/my-shipments.tsx` — list with search bar; navigates to `shipment-tracking?id=`
- `app/(customer)/shipment-tracking.tsx` — main tracking screen (map, timeline, transit card)
- `app/(customer)/profile.tsx` — editable name + company, read-only phone, sign out

### WS_BASE_URL in config.ts
`Config.WS_BASE_URL` is derived automatically from `API_BASE_URL` by replacing `http://` → `ws://`
and `https://` → `wss://`. Override via `EXPO_PUBLIC_WS_URL` env var if needed.

### react-native-maps integration
- Installed via `npx expo install react-native-maps -- --legacy-peer-deps`
- Plugin added to `app.json` with `PLACEHOLDER` API keys (replace with real keys before production build)
- iOS and Android `config.googleMaps*` keys also set to `PLACEHOLDER`
- MapView renders in Expo Go on Android without a key in dev mode

### Customer shipment-tracking.tsx sections
1. **Dark header card** — tracking ID, status label, 4-step phase progress dots (red filled/pulsing/gray)
2. **ETA card** (white) — large date + time; replaced by green "Delivered" card when completed
3. **Live tracking** (pickup/delivery phase) — `react-native-maps` MapView 220px, auto-refreshes location every 10s, WebSocket updates marker in real-time
4. **Transit card** (transit phase) — large train/plane icon, transport number, admin status events shown as mini-timeline
5. **Status timeline** — all events with green checkmarks (done), red pulsing (current), gray (pending)
6. **Expandable details** — tap to reveal origin/destination/transport/goods/notes

### WebSocket in shipment-tracking.tsx
- Opens `ws://<WS_BASE_URL>/ws/<shipment_id>` on mount, closes on unmount
- `phase_change` and `status_update` → calls `load()` to re-fetch full shipment
- `location` messages → handled inside `LiveMapSection` component via a shared `wsRef`
- WS errors are silently swallowed (REST polling handles updates as fallback)

### Location polling in LiveMapSection
- `getLatestLocation(shipmentId)` called on mount + every 10 seconds via `setInterval`
- If API returns null → shows placeholder card "Tracking will begin when driver starts their journey"
- Map region delta: 0.01 (street level)

---

## Firebase Admin SDK setup (required for production OTP)

1. Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key" → download JSON
3. Save as `backend/firebase-service-account.json` (gitignored)
4. Backend auto-detects it on startup

---

## How to run

**Frontend:**
```bash
cd C:/SattyGithub/DGVJ-Shipment-Tracker
npx expo start --clear
# Scan QR with Expo Go on Android
# Use Dev Mode role selector to bypass OTP (default: enabled)
```

**Backend (first-time setup):**
```bash
cd backend
python -m venv venv

# Activate on Windows:
venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --reload
# Docs at http://localhost:8000/docs
# Health check: http://localhost:8000/health
# For physical device access: uvicorn main:app --reload --host 0.0.0.0
```

**Backend (subsequent runs — venv already created):**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

**Installing new packages:**
```bash
# Expo-managed packages:
npx expo install <package> -- --legacy-peer-deps

# Other npm packages:
npm install <package> --legacy-peer-deps
```
