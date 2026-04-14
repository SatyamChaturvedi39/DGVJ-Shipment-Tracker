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
| Auth | Phone + 4-digit PIN — JWT (PyJWT) stored in AsyncStorage; **Firebase removed** |
| Backend | FastAPI (Python) |
| Database | PostgreSQL via Supabase (free tier) |
| Real-time GPS | WebSockets |
| Maps | react-native-maps + Google Maps API |
| Hosting | Render.com (backend) + Supabase (DB) |

---

## Key constraints (never violate)

- **Free tier only** — Supabase free, Render free; no Firebase billing needed (Firebase removed)
- **Professional B2B UI** — Delhivery/BlueDart level polish
- **No email lock-in** — GitHub, Supabase, Render not tied to any specific email
- **India-only phone numbers** — +91 prefix hardcoded on login screen
- **`npm install` must use `--legacy-peer-deps`** — supabase conflict with React 19
- **`npx expo install` syntax for Expo packages:** `npx expo install <pkg> -- --legacy-peer-deps`

---

## Database schema

```sql
users:               id, phone, name, role, company_name, firebase_uid, pin_hash, is_active, created_at
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

| Phase | Customer map shows | GPS source | Who triggers |
|-------|--------------------|------------|--------------|
| pickup | Live map | Employee 1 (pickup driver) | Employee 1: "Mark as Picked Up" |
| transit | Live map (still driving to carrier) | Employee 1 | Employee 1: "Drop at Airport/Railway" |
| handed_to_carrier | Static card: transport number + manual updates | None | Employee 2: "Picked Up from Carrier" |
| out_for_delivery | Live map | Employee 2 (delivery driver) | Employee 2: "Mark as Delivered" |
| completed | Summary | None | — |

Phase order: `pickup → transit → handed_to_carrier → out_for_delivery → completed`

- **Employee 1** (pickup driver) triggers: pickup→transit, transit→handed_to_carrier
- **Employee 2** (delivery driver) triggers: handed_to_carrier→out_for_delivery, out_for_delivery→completed
- **Admin** can manually advance any phase as a failsafe override (not the primary mechanism)
- `PUT /shipments/{id}/phase` uses `require_role("admin", "employee")` — both roles can advance phases, but employee authz checks assignment + correct role for phase.

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
  main.py                  # FastAPI app with CORS, rate limiting (slowapi), security headers
  database.py              # Supabase client singleton
  dependencies.py          # get_current_user, require_role(), verify_token_string() (for WS)
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
# ── Dev: emulator / Expo Go on same machine ──────────────────────────────────
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_DEV_MOCK_AUTH=true

# ── Dev: physical device on same Wi-Fi ───────────────────────────────────────
EXPO_PUBLIC_API_URL=http://<YOUR_LAPTOP_LAN_IP>:8000
EXPO_PUBLIC_DEV_MOCK_AUTH=false     # forces real OTP flow

# ── Production EAS build ─────────────────────────────────────────────────────
EXPO_PUBLIC_PROD_API_URL=https://digvijay-blr.onrender.com
EXPO_PUBLIC_PROD_WS_URL=wss://digvijay-blr.onrender.com
EXPO_PUBLIC_DEV_MOCK_AUTH=false
```

After changing `.env`, always restart with `npx expo start --clear` — env vars are inlined at bundle time.

**How dev vs prod URL is selected (`constants/config.ts`):**
- `__DEV__ === true` (Expo Go / dev build) → uses `EXPO_PUBLIC_API_URL`
- `__DEV__ === false` (EAS production/preview build) → uses `EXPO_PUBLIC_PROD_API_URL`
- WS URL is derived automatically by replacing `http://` → `ws://` unless overridden.

---

## Build phases

| Phase | Status | What |
|-------|--------|------|
| 1 | ✅ DONE | Project setup, Firebase OTP auth, role-based navigation skeleton |
| 2 | ✅ DONE | FastAPI backend, Supabase schema, all API endpoints, WebSocket server |
| 3 | ✅ DONE | All 4 Admin screens (dashboard, create-shipment, archive, shipment-detail) |
| 4 | ✅ DONE | Employee screens (my-jobs, job-detail) + live GPS tracking |
| 5 | ✅ DONE | Customer screens + tracking UI (live map for pickup/delivery phases) |
| 6 | ✅ DONE | Testing: 30 pytest tests green, 0 TypeScript errors, integration check script, manual test comments |
| 7 | ✅ DONE | Polish + production deployment: Render config, EAS build, env var cleanup, v1.0.0 tag |
| 8 | ✅ DONE | Closed auth system + admin user management Team screen |
| 9 | ✅ DONE | Production readiness + UI polish (wordmark, phase-specific buttons, timeline dots, transit icons, tracking banner) |
| 10 | ✅ DONE | Bug fixes: employee job filter, map animation, hard delete user, multi-select polish, DateTimePicker for ETA |
| 11 | ✅ DONE | Final production: Invalid Date fix, timeline sort_order, security hardening (CORS/WS auth/rate limiting/employee authz), real SMS OTP via @react-native-firebase, ETA delay warning, 5-phase employee-driven flow |
| 12 | ✅ DONE | Auth replacement (PIN), design polish (keyboard fix, safe-area insets, responsive fonts), app icon generator |
| 13 | ✅ DONE | First-time PIN setup, Forgot PIN, Remember Me, archive redesign, customer UUID fix |
| 14 | ✅ DONE | FIRST_LOGIN redirect fix, phantom WS popup fix, GPS auto-start, admin notes split, customer history tabs, tracking ID edit, ETA date fix, improved icon |

---

## Deployment

### Backend — Render.com

1. Push repo to GitHub (backend/ folder included).
2. Go to render.com → New → Web Service → connect repo.
3. Set **Root Directory** to `backend`.
4. Render auto-detects `render.yaml` — build/start commands are pre-filled.
5. Add these env vars in Render Dashboard → Environment:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `FIREBASE_PROJECT_ID`
6. Upload `firebase-service-account.json` as a Secret File (Render Dashboard → Secret Files) at path `./firebase-service-account.json`.
7. Deploy. Live URL will be `https://digvijay-blr-api.onrender.com` (or similar).
8. Set `EXPO_PUBLIC_PROD_API_URL=https://<your-render-url>` before building the APK.

**Procfile** and **render.yaml** are both present in `backend/` — either will work.

### Frontend — EAS Build (Android APK)

**One-time setup:**
```bash
npm install -g eas-cli
eas login          # sign in with your Expo account
eas build:configure
```

**Build preview APK (internal distribution):**
```bash
# Set production URL in .env first:
# EXPO_PUBLIC_PROD_API_URL=https://<your-render-url>
# EXPO_PUBLIC_DEV_MOCK_AUTH=false
npx expo start --clear   # verify env vars are picked up
eas build --profile preview --platform android
```
This produces a `.apk` you can install directly on any Android device.

**Build production AAB (Play Store submission):**
```bash
eas build --profile production --platform android
```

**Do NOT run eas build** unless you have an Expo account and are ready to submit — it queues on Expo's cloud servers and uses build minutes.

---

## Known issues / production gaps

### 1. Firebase OTP removed — PIN auth replaces it
- Firebase Phone Auth required a paid Blaze plan for real SMS — removed in Phase 12.
- Auth is now Phone + 4-digit PIN. Admin sets the PIN when creating a user, tells them via WhatsApp/call.
- `services/firebase.ts` still exists but is no longer imported anywhere — safe to delete if desired.

### 2. `POST /location/update` skipped in dev mode
- **Root cause:** Requires employee role; dev-mock-token returns admin → 403.
- **Current state:** In `job-detail.tsx`, location updates are skipped when `Config.DEV_MOCK_AUTH` is true. GPS UI (watcher, coordinates display) works normally.
- **To fix for production:** No code change needed — real employee tokens will pass the role check.

### 3. Local network connectivity between phone and laptop
- Windows hotspot and most Wi-Fi routers block device-to-device (phone→laptop) traffic (AP Isolation / ICS firewall).
- **Workaround A — ADB reverse (USB cable, no network needed):**
  1. Enable USB Debugging on phone (Settings → Developer Options)
  2. Connect USB cable; run: `C:\platform-tools\adb.exe reverse tcp:8000 tcp:8000`
  3. Set `.env`: `EXPO_PUBLIC_API_URL=http://localhost:8000`
  4. `npx expo start --clear` then press `a` in terminal
- **Workaround B (permanent) — Deploy to Render.com:** Use the deployed backend URL. No local network issues. See `DEPLOYMENT_CHECKLIST.md`.
- **Dev mock token requires an admin user in Supabase** — the backend looks for `role='admin'`. Admin user for this project: `+919663469507` (already inserted). If DB is reset, re-run: `INSERT INTO users (phone, name, role, is_active) VALUES ('+919663469507', 'Admin', 'admin', true);`

### 4. Backend must bind to 0.0.0.0 for LAN access
- Default `uvicorn main:app --reload` binds to `127.0.0.1` (localhost only).
- For physical device testing: `uvicorn main:app --reload --host 0.0.0.0`

### 5. react-native-maps plugin removed from app.json
- v1.20.1 has no `app.plugin.js` — adding it to `plugins` crashes Expo start.
- Google Maps API key is set correctly under `android.config.googleMaps.apiKey` in app.json instead.
- Do NOT re-add `react-native-maps` to the `plugins` array.

---

## What's real vs placeholder (as of Phase 7 / v1.0.0)

| Thing | State |
|-------|-------|
| Firebase config | Real keys in .env (EXPO_PUBLIC_FIREBASE_*) |
| Firebase Admin SDK | Needs firebase-service-account.json in /backend |
| All backend API endpoints | ✅ Fully implemented, connected to Supabase |
| WebSocket /ws/{shipment_id} | ✅ Fully implemented with ConnectionManager |
| Admin screens (all 4) | ✅ Fully implemented — Phase 3 complete |
| Employee my-jobs screen | ✅ Fully implemented — Phase 4 complete |
| Employee job-detail screen | ✅ Fully implemented — Phase 4 complete |
| Customer my-shipments screen | ✅ Fully implemented — Phase 5 complete |
| Customer shipment-tracking screen | ✅ Fully implemented — Phase 5 complete |
| Customer profile screen | ✅ Fully implemented — Phase 5 complete |
| expo-location | ✅ Installed (~19.0.8), plugin added to app.json |
| react-native-maps | ✅ Installed (SDK 54 compatible), plugin REMOVED from app.json (v1.20.1 has no app.plugin.js) |
| Google Maps API key | PLACEHOLDER — replace before production build |
| backend/render.yaml | ✅ Created — deploy by connecting repo to Render.com |
| eas.json | ✅ Created — preview (APK) and production (AAB) profiles ready |
| app.json package name | com.digvijayexpress.blr, versionCode 1, version 1.0.0 |
| Splash screen | ✅ Brand red (#C62828) background |

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

## Key implementation notes (from Phase 6)

### Backend test suite (`backend/tests/`)

| File | What it tests |
|------|---------------|
| `conftest.py` | Session-scoped test admin user in Supabase + `get_current_user` dependency override |
| `test_health.py` | `GET /health` — 3 tests |
| `test_shipments.py` | Full CRUD + phase transitions + status events — 13 tests |
| `test_users.py` | `/users/me`, `/users/employees`, `/users/customers`, `PUT /users/me` — 10 tests |
| `test_location.py` | 403 for admin on employee endpoint, 403 with no auth, null response when empty — 4 tests |
| `integration_check.py` | Standalone script: full lifecycle + WebSocket test against live server |

**Run:** `cd backend && pytest tests/ -v` — **30/30 pass**

### Auth strategy in tests
- FastAPI `dependency_overrides` replaces `get_current_user` with a mock that returns a test admin.
- The mock still declares `Depends(HTTPBearer())` so requests with **no** Authorization header still get 403.
- A real admin user row (`id = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`) is inserted into Supabase before tests and deleted after, so `shipments.created_by` FK constraints are satisfied.
- All shipments created during tests are cascade-deleted in teardown.

### TypeScript fixes (Phase 6)
- `Colors.accent` → `Colors.primary` in `app/auth/verify.tsx` (×2) and `components/ui/OTPInput.tsx`
- `Colors.danger` → `Colors.error` in `app/auth/verify.tsx`
- `getReactNativePersistence` moved to `require('firebase/auth')` cast in `services/firebase.ts` (not in Firebase 12 public TS types but present at runtime)

### Integration check script
```bash
# Start backend first:
cd backend && venv\Scripts\activate && uvicorn main:app --reload

# Then in a separate terminal:
python backend/tests/integration_check.py
```
Tests 12 REST steps + 1 WebSocket step. Prints PASS/FAIL/SKIP for each.
`POST /location/update` is KNOWN_SKIP (requires employee token; dev-mock-token is admin).

### TEST_REPORT.md
Created at repo root — summary of all automated results + manual test checklist.

---

## Future improvements (post-v1.0.0)

- **Real SMS OTP on physical device** — Switch from Firebase JS SDK to `@react-native-firebase/auth` (requires EAS Build, not Expo Go). Steps: (1) `npx expo install @react-native-firebase/app @react-native-firebase/auth -- --legacy-peer-deps`, (2) run `eas build --profile preview --platform android`, (3) get SHA-1 fingerprint from the EAS build → add to Firebase Console → Android app → Add fingerprint, (4) replace `fakeRecaptchaVerifier` usage in `services/auth.ts` with `@react-native-firebase/auth` phone sign-in, (5) remove Firebase JS SDK auth imports from `services/firebase.ts`. Do this after Render backend is stable.
- **Google Maps API key for production** — Replace `PLACEHOLDER` values in `app.json` with a real key from Google Cloud Console. MapView in Expo Go dev mode does not need a key.
- **Employee phase transitions in production** — Change `require_role("admin")` → `require_role("admin", "employee")` in `backend/routes/tracking.py` and add ownership checks.
- **Push notifications** — Send status-change notifications to customers via Expo Push Notifications or Firebase FCM.
- **Train/flight API integration** — Auto-populate transport status from IRCTC/airline APIs (Phase 2 of product roadmap).
- **Role management UI** — Admin screen to assign employee/customer roles instead of using SQL.

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

**Run backend tests:**
```bash
cd backend
venv\Scripts\activate
pytest tests/ -v
# Expected: 30/30 pass
```

**Run integration check (requires backend running):**
```bash
python backend/tests/integration_check.py
```

**Build Android APK (preview/internal distribution):**
```bash
# 1. Install EAS CLI once:
npm install -g eas-cli
eas login

# 2. Set production env vars in .env:
#    EXPO_PUBLIC_PROD_API_URL=https://<your-render-url>
#    EXPO_PUBLIC_DEV_MOCK_AUTH=false

# 3. Build:
eas build --profile preview --platform android
# Downloads a .apk you can sideload on any Android device
```

**Installing new packages:**
```bash
# Expo-managed packages:
npx expo install <package> -- --legacy-peer-deps

# Other npm packages:
npm install <package> --legacy-peer-deps
```

---

## Key implementation notes (from Phase 7)

### URL config (constants/config.ts)
- Dev builds (`__DEV__ === true`): uses `EXPO_PUBLIC_API_URL` (default `http://localhost:8000`)
- Production builds (`__DEV__ === false`): uses `EXPO_PUBLIC_PROD_API_URL` (default `https://digvijay-blr.onrender.com`)
- WS URL auto-derived by swapping `http://` → `ws://`; override with `EXPO_PUBLIC_WS_URL` / `EXPO_PUBLIC_PROD_WS_URL`

### Dev mode guard in login.tsx
- The role-selector block is wrapped in `{Config.DEV_ROLE_SELECTOR && (...)}`.
- `Config.DEV_ROLE_SELECTOR` is `false` when `EXPO_PUBLIC_DEV_MOCK_AUTH` is not `true`.
- Production EAS builds (where `DEV_MOCK_AUTH` is unset or `false`) will never render the bypass UI.

### EAS build profiles (eas.json)
- `development` — dev client build for testing with Expo Dev Tools
- `preview` — internal APK distribution; use this to share the app before Play Store
- `production` — AAB for Google Play Store submission

### Backend Render.com deployment files
- `backend/render.yaml` — declarative config auto-detected by Render on first deploy
- `backend/Procfile` — fallback; same start command
- CORS is `allow_origins=["*"]` — acceptable for now; tighten after confirming production domain

### app.json changes (Phase 7)
- `android.versionCode: 1` — required for Play Store; increment on each APK/AAB release
- `splash.backgroundColor` changed from `#1B2A4A` → `#C62828` (brand red) for consistent branding

---

## Key implementation notes (from Phase 8)

### Closed auth system (`backend/routes/auth.py`)
3-step flow in `POST /auth/verify-token`:
1. Look up by `firebase_uid` → returning user (+ is_active check)
2. Look up by `phone WHERE firebase_uid IS NULL` → first login of pre-registered user; binds uid (+ is_active check)
3. Neither found → `403 "Your number is not registered. Contact Digvijay Express to get access."`

**Critical supabase-py v2 syntax for IS NULL:**
```python
supabase.table("users").select("*").eq("phone", phone).is_("firebase_uid", "null").execute()
```
Use string `"null"` — **not** Python `None`.

**Required Supabase migration (already run):**
```sql
ALTER TABLE users ALTER COLUMN firebase_uid DROP NOT NULL;
```

### Admin Team screen (`app/(admin)/team.tsx`)
- 4th tab in admin layout (after Archive)
- Two sub-tabs: Employees (N) | Customers (N)
- Add Employee / Add Customer buttons in header — opens bottom sheet modal
- Phone validated as exactly 10 digits; stored as `+91` + digits
- 409 from API → shows "This phone number is already registered" inline
- Tap a user row → action sheet: Edit Details / Deactivate|Reactivate / Delete (soft delete)
- Inactive users shown at 0.6 opacity

### `GET /users` endpoint ordering
Returns all non-admin users ordered by role then name. The Team screen filters client-side by `u.role`.

### `authError` in AuthContext
- New `authError: string | null` state exposed from `AuthContext`
- Set when `getMe()` returns 403 (unknown/deactivated phone) — Firebase session is signed out via `signOutService()`
- Displayed as red banner on login screen above the phone input
- Cleared when user edits the phone field (`clearAuthError()`)

### `is_active` field in User type
- Added to `types/index.ts` User interface (`is_active: boolean`)
- `firebase_uid` changed from `string` to `string | null` to accommodate pre-registered users

### Team screen header (`app/(admin)/team.tsx`)
- `headerShown: false` set on the Team tab in `app/(admin)/_layout.tsx` — Team uses its own custom dark header
- `SafeAreaView` must use `edges={['top', 'bottom']}` (NOT just `['bottom']`) — otherwise the header renders behind the status bar
- Sign Out button is in the Team screen's custom header (not the nav header)

### Logout buttons (Phase 8 bugfix)
- Admin: "Sign Out" button in `screenOptions.headerRight` in `app/(admin)/_layout.tsx` — appears on Dashboard, New Shipment, Archive tabs. Shows confirmation Alert before signing out.
- Employee: Sign Out button + employee name in `headerRight` of My Jobs tab in `app/(employee)/_layout.tsx`
- Team tab uses its own Sign Out (see above)

### Create Shipment validation (Phase 8 bugfix)
- ETA Date is now **required** (was optional before)
- ETA Time validates HH:MM format if provided
- Both show inline field errors

---

## Key implementation notes (from Phase 9)

### UI polish changes (Phase 9)
- **Login screen:** Replaced "D" letter box with DIGVIJAY/EXPRESS/BLR wordmark. Subtitle: "Bangalore Branch — Shipment Tracking". Button: "Send OTP →".
- **Dashboard:** Stat cards have emoji icons (📦 ✈ ✅). Shipment cards have 4px left border in phase color (amber/blue/green). Section header shows live count. Empty state is action-oriented.
- **Create Shipment:** Section headers have 3px red left border. Selected toggle option uses red outline + light tint instead of full red fill. Button says "Create Shipment →". After creation: 2-second success overlay screen before navigating back.
- **Shipment Detail:** Timeline dots — completed = solid red circle with white ✓, current = pulsing red outlined circle, pending = gray outlined circle. Phase badge is larger (15px, padded). Advance button shows specific label: "Mark as In Transit →", "Mark as Out for Delivery →", "Mark as Delivered ✓".
- **Customer Tracking:** Phase progress connecting lines — red for completed segments, semi-transparent white for pending (on dark header). ETA date is 28px bold. Transit card shows large icon (🚂/✈️ at 56px) and transport number in monospace font.
- **Employee Job Detail:** Green "TRACKING ACTIVE" banner appears at top of scroll when GPS is on. Action buttons are 56px tall with 📦/✓ icons.
- **All screens:** Loading states have descriptive label below spinner. Section header style: 11px uppercase letterSpacing 0.8. Cards use `borderWidth: 1, borderColor: Colors.border`, `shadowOpacity: 0.04` max.

### render.yaml fix
`rootDir: backend` added to `backend/render.yaml` — was missing, which would have caused Render to look for `requirements.txt` in the repo root instead of the `backend/` folder.

### Deployment docs
- `DEPLOYMENT_CHECKLIST.md` in project root — full manual steps for Render.com deployment, Supabase verification, Firebase test phones, and EAS APK build.
- `.env.example` restructured with three clear sections: LOCAL DEVELOPMENT, PHYSICAL DEVICE TESTING, PRODUCTION.

---

## Key implementation notes (from Phase 10)

### Employee My Jobs Active tab filter
`my-jobs.tsx` `activeJobs` filter now enforces role-phase alignment:
- In dev mode (`Config.DEV_MOCK_AUTH`): shows all assigned shipments in pickup/delivery phase (browsability)
- In production: pickup drivers only see shipments in pickup phase; delivery drivers only in delivery phase
- Uses `getEmployeeRole(s, userId)` which returns 'delivery' if `delivery_employee_id === userId`, else 'pickup'

### Customer map animation (LiveMapSection in shipment-tracking.tsx)
- Added `mapRef = useRef<MapView | null>(null)` and `ref={mapRef}` on MapView
- Changed `region={region}` (controlled/jumpy) → `initialRegion={initialRegion}` (uncontrolled; subsequent moves via animateToRegion)
- Calls `mapRef.current?.animateToRegion(..., 800)` on both WS location messages and REST poll updates
- `DriverStatusCard` component shows tracking status and last-updated time below the map in both placeholder and live states. Replaces the old `mapLabel` row.

### Hard delete user (backend/routes/users.py)
`DELETE /users/{user_id}` now:
1. Checks user exists → 404 if not
2. Deletes `shipment_permissions` rows where `customer_user_id = user_id` (cascade cleanup)
3. Deletes the `users` row
Previously this was a soft-delete (set `is_active = False`). The `PUT /users/{id}` endpoint (via `updateUser()`) still handles deactivate/reactivate separately.

### Team screen instant delete (app/(admin)/team.tsx)
On successful delete, the user is removed from local `employees`/`customers` state immediately using `prev.filter(e => e.id !== u.id)`. No network reload needed. The confirmation dialog now says "cannot be undone."

### DateTimePicker for ETA fields (app/(admin)/create-shipment.tsx)
- `@react-native-community/datetimepicker` installed; plugin added to `app.json` by `expo install`
- ETA Date and ETA Time fields replaced with tappable rows (same `dropdownBtn` style as employee/customer pickers)
- `handleDateChange` / `handleTimeChange`: format Date object to YYYY-MM-DD / HH:MM strings
- On Android: picker dialog fires once and closes (`setShowDatePicker(false)`). On iOS: spinner stays open (`Platform.OS === 'ios'` guard)
- `validate()` no longer checks format regex (picker guarantees format); only checks ETA date is required

### MultiSelectPicker polish (app/(admin)/create-shipment.tsx)
- Summary button shows "N customers selected" (singular/plural) instead of comma-joined names
- Done button moved from modal bottom to header row (top-right, `Colors.primary` text)
- Old `modalDoneBtn` and `modalDoneText` styles removed; new `modalHeaderRow` and `modalDoneTextBtn` added
- `modalTitle` style no longer has `paddingHorizontal`/`borderBottom` (moved to `modalHeaderRow`)

### Test suite: 32 tests (was 30)
Two new tests in `backend/tests/test_users.py`:
- `test_delete_user_removes_from_db` — creates temp user, deletes, confirms absent from GET /users
- `test_delete_user_not_found` — nil UUID returns 404

---

## Key implementation notes (from Phase 11)

### Invalid Date fix
`status_events` table has `created_at` column; frontend type expects `timestamp`. Backend was returning raw Supabase rows. Fixed by mapping in both `routes/shipments.py` (GET /shipments/{id}) and `routes/tracking.py` (POST /shipments/{id}/status-event):
```python
{**event, "timestamp": event["created_at"]}
```

### Timeline sort_order
Added `sort_order INTEGER DEFAULT 99` column to `status_events`. Initial 6 events get sort_order 1–6 (Picked Up=1 … Delivered=6). Admin-added events keep default 99 (always appear last). Phase transition event lookup now orders by `sort_order, created_at`. **Requires Supabase migration** (see migration SQL in plan).

### Security hardening
- **CORS**: `allow_origins` now reads `ALLOWED_ORIGINS` env var (comma-separated). Defaults to `["*"]` for mobile-only API; set specific domain in Render for web clients.
- **Rate limiting**: `slowapi==0.1.9` added. Default 120 req/min per IP.
- **Security headers**: Middleware adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`. `Strict-Transport-Security` only in production (`ENVIRONMENT=production`).
- **Mock auth gate**: `dev-mock-token` bypass disabled when `ENVIRONMENT=production` in `dependencies.py`.
- **WebSocket auth**: `/ws/{shipment_id}?token=<id_token>` — server verifies token and checks shipment access before connecting. Closes with code 4001 (unauth), 4003 (forbidden), 4004 (not found).
- **Employee authorization**: Phase transitions check employee is assigned + can only advance their own phase (pickup driver → transit, delivery driver → completed). Location updates verify assignment.

### Real SMS OTP (@react-native-firebase)
`services/auth.ts` now has a dual-path strategy:
- `Config.DEV_MOCK_AUTH === true` (Expo Go): existing mock flow (accepts `123456`)
- Production EAS build: `@react-native-firebase/auth` `signInWithPhoneNumber()` → real SMS
- Fallback: if native module unavailable (Expo Go without mock mode), tries JS SDK `fakeRecaptchaVerifier` (Firebase test numbers only)
- `app.json` plugins include `@react-native-firebase/app` and `@react-native-firebase/auth`

**To activate real OTP:**
1. Download `google-services.json` from Firebase Console → Android App → place in repo root (gitignored)
2. Run `eas build --profile preview --platform android`
3. Get SHA-1 from build output → Firebase Console → Android App → Add fingerprint
4. Set `EXPO_PUBLIC_DEV_MOCK_AUTH=false` in `.env`

### ETA delay warning (customer tracking)
`isETAPast(eta_date)` (from `utils/formatDate.ts`) checks if ETA date is in the past. If true and shipment is not completed: ETA card gets amber border + "Contact Digvijay Express for updates" note.

### utils/formatDate.ts
New shared utility at `utils/formatDate.ts`:
- `formatEventDate(timestamp)` — safe date for timeline items (returns "Pending" for null/invalid)
- `formatFullDate(timestamp)` — full date for completed_at banners
- `formatETA(etaDate, etaTime)` — ETA display
- `isETAPast(etaDate)` — true if ETA is before now

Used in `app/(admin)/shipment-detail.tsx`, `app/(customer)/shipment-tracking.tsx`, `app/(employee)/job-detail.tsx`.

### Production env vars to add on Render
- `ENVIRONMENT=production` — disables mock auth, enables HSTS header
- `ALLOWED_ORIGINS=https://yourdomain.com` — optional, only needed if adding a web client

---

## Key implementation notes (from Phase 11 — 5-phase flow)

### New phase flow (employee-driven)
```
pickup → transit → handed_to_carrier → out_for_delivery → completed
```
- Employee 1 (pickup driver) drives phases 1 and 2; GPS active in both
- Employee 2 (delivery driver) drives phases 4 and 5; GPS active in phase 4
- Phase 3 (`handed_to_carrier`) = goods with airline/railway; no GPS, transit card shown
- Admin can force-advance any phase as a failsafe from shipment-detail screen

### PHASE_EVENT_MAP in backend/routes/tracking.py
Controls which initial status events get marked `is_completed` per phase transition:
```python
PHASE_EVENT_MAP = {
    "transit":           [0],       # "Picked Up"
    "handed_to_carrier": [1, 2],    # "Heading to Carrier" + "Handed to Carrier"
    "out_for_delivery":  [3, 4],    # "Picked Up from Carrier" + "Out for Delivery"
    "completed":         [5],       # "Delivered"
}
```

### Employee authorization in phase transitions
- `handed_to_carrier` and `transit` → only pickup driver (Employee 1)
- `out_for_delivery` and `completed` → only delivery driver (Employee 2)
- Dev mode: `Config.DEV_MOCK_AUTH` bypasses role checks on frontend; backend still enforces

### job-detail.tsx architecture (Phase 11 rewrite)
- `PhaseStepBar`: 5-dot progress bar in dark header card
- `GpsCard`: inline GPS start/stop toggle with pulsing dot
- `getAction(phase, isPickup, isDelivery, transportMode)` → returns `ActionConfig | null`
- "YOUR NEXT ACTION" card shows at top when employee has an action to take
- `carrierName(transportMode)` → "Airport" | "Railway Station"
- GPS active for: pickup employee during `pickup`+`transit`; delivery employee during `out_for_delivery`
- Purple "With Carrier" wait card shown to delivery employee during `handed_to_carrier` phase

### Required Supabase migration (for sort_order column)
```sql
ALTER TABLE status_events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 99;
```
Run this in Supabase SQL Editor if not already done.

---

## Key implementation notes (from Phase 12)

### Auth replacement: Phone + PIN (Firebase removed)

**Why:** Firebase Phone Auth requires Blaze paid plan for real SMS. Replaced with backend-issued JWT + 4-digit PIN — free, simpler, appropriate for a closed B2B system.

**Login flow:**
1. User enters phone → `loginWithPhone()` stores it locally, navigates to verify screen
2. User enters 4-digit PIN → `loginWithPin(phone, pin)` calls `POST /auth/login` → backend returns JWT + user profile
3. JWT stored in AsyncStorage. On next app open, `getStoredToken()` → `GET /users/me` restores session.

**Backend:**
- `backend/utils/jwt_utils.py` — NEW: `create_token(user_id)` / `decode_token(token)` using PyJWT HS256, 365-day expiry
- `backend/routes/auth.py` — `POST /auth/login` (phone+pin→JWT), `POST /auth/set-pin` (authenticated PIN change)
- `backend/dependencies.py` — replaced `firebase_auth.verify_id_token()` with `decode_token()` from jwt_utils
- `backend/routes/users.py` — `create_user` now accepts optional `pin` field, hashes with bcrypt, stores as `pin_hash`
- `backend/requirements.txt` — added `PyJWT>=2.0.0`, `bcrypt>=4.0.0`; removed `firebase-admin`
- Hashing: uses `bcrypt` directly (not passlib — passlib 1.7.4 incompatible with bcrypt 5.x)

**Frontend:**
- `services/auth.ts` — complete rewrite: `loginWithPhone`, `loginWithPin`, `getStoredToken`, `clearToken`, `getIdToken`, `setPin`, `signOut`
- `context/AuthContext.tsx` — simplified: startup reads `getStoredToken()` → `getMe()`; no Firebase/onAuthStateChanged
- `services/api.ts` — removed `verifyToken()` function; added `pin?: string` to `createUser` payload
- `app/auth/login.tsx` — calls `loginWithPhone()`; hint text updated; keyboard structure fixed for Android
- `app/auth/verify.tsx` — renamed "Enter PIN", 4-digit `OTPInput`, no resend timer, `edges={['top','bottom']}`

**Required Supabase migration (run once in SQL Editor):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
```

**Required Render env var (add after deploy):**
```
JWT_SECRET_KEY=<random 32+ char string>
```

**Dev mode unchanged:** `dev-mock-token` / `dev-mock-token:phone` still works — just uses AsyncStorage mock token path and bypasses PIN entry.

### Design polish (Phase 12)

- **Login keyboard fix:** `SafeAreaView edges={['top','bottom']}`, `KeyboardAvoidingView behavior="padding"` wrapping both brand and body, body is `ScrollView` — no more red/white flicker on Android.
- **Login responsive font:** `useWindowDimensions()` → `brandFontSize = width < 380 ? 34 : 42`
- **Profile sticky bar:** `useSafeAreaInsets().bottom` → `paddingBottom: Math.max(insets.bottom, 16)`. ScrollView content padding also dynamic: `80 + barPaddingBottom`.
- **Verify screen:** `edges={['top','bottom']}` on SafeAreaView. Resend timer removed.

### App icon generator (Phase 12)

`scripts/generate-icon.js` — Node.js script using `@napi-rs/canvas`:
```bash
npm install --save-dev @napi-rs/canvas
node scripts/generate-icon.js
```
Outputs:
- `assets/icon.png` — 1024×1024, red background, white "D" + "BLR" text
- `assets/adaptive-icon.png` — 1024×1024, transparent background (Android adaptive)
- `assets/splash-icon.png` — 512×512, red background, "D" only

`app.json` change: `android.adaptiveIcon.backgroundColor` changed from `#1B2A4A` → `#C62828`.
`@react-native-firebase/app` and `@react-native-firebase/auth` removed from `plugins` array.
`googleServicesFile` removed from `app.json` (no longer needed).

### Change PIN (customer profile)

`app/(customer)/profile.tsx` now has a "Change PIN" row → opens bottom-sheet modal.
Modal: New PIN (4 digits) + Confirm PIN → calls `setPin(newPin)` from `services/auth.ts` → `POST /auth/set-pin`.

---

## Key implementation notes (from Phase 14)

### FIRST_LOGIN redirect (Phase 14)
`POST /auth/check-phone` — new endpoint, no auth. Returns `{"status": "needs_pin" | "first_login"}`. Frontend calls it in `loginWithPhone()` before navigating. `login.tsx` routes to `/auth/setup-pin` when `first_login` instead of `/auth/verify`.

### Phantom popup fix (Phase 14)
`job-detail.tsx`: `skipNextPhaseAlert = useRef(false)`. Set to `true` before every `transitionPhase()` call (including Undo Pickup). WS `phase_change` handler: if ref is true, reload silently and return — no Alert shown.

### GPS auto-start (Phase 14)
`job-detail.tsx`: `prevShowGpsRef` tracks previous `showGps` value. `useEffect` on `showGps` calls `startTracking()` when it transitions from `false` → `true`. For GPS-continuation transitions (`transit`, `out_for_delivery`): `confirmTransition` does NOT call `stopTracking()` or `router.back()`; it calls `load()` instead, which re-triggers the GPS auto-start effect.

### Admin notes vs system timeline (Phase 14)
`StatusEvent` type now has `sort_order?: number`. In `shipment-tracking.tsx`, events are split: `sort_order <= 6` → main "Status Timeline", `sort_order > 6` (admin-added, default 99) → amber "Updates from Digvijay Express" card below the timeline. Neither section shows if empty.

### Customer shipment history tabs (Phase 14)
`my-shipments.tsx` has Active / History tab bar above the search bar. Active = `current_phase !== 'completed'`. History = completed shipments. Empty states are tab-specific.

### Admin edit tracking ID (Phase 14)
`UpdateShipmentRequest` now includes `tracking_id: Optional[str]`. Admin shipment-detail header: tap tracking ID → inline edit row with save/cancel. Save calls `PUT /shipments/{id}` with `{tracking_id}` and reloads.

### ETA date fix (Phase 14)
`formatETA()` in `utils/formatDate.ts` now uses `T12:00:00Z` (noon UTC) instead of `T00:00:00Z` (midnight) to prevent date rollover in IST/other timezones. When `eta_time` is present, the time is appended to the formatted date.
