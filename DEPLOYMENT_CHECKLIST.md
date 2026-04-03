# Deployment Checklist — Digvijay BLR

## Pre-Deploy: Push Code to GitHub

```bash
git add .
git commit -m "Phase 9: Production readiness + UI polish"
git push origin master
```

---

## Backend: Deploy to Render.com

### Step 1 — Create a new Web Service

1. Go to [render.com](https://render.com) → Sign in → **New** → **Web Service**
2. Connect your GitHub account if not already connected
3. Select the `DGVJ-Shipment-Tracker` repository

### Step 2 — Configure the Service

Render will auto-detect `backend/render.yaml`. Verify these settings:

| Setting | Value |
|---------|-------|
| Name | `digvijay-blr-api` |
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Environment | Python |

### Step 3 — Add Environment Variables

In **Render Dashboard → Environment → Add Environment Variable**:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | From Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | From Supabase → Settings → API → service_role key |
| `FIREBASE_PROJECT_ID` | `dvgj-shipment-tracker` |

> Do NOT add `SUPABASE_ANON_KEY` to Render — it is not used by the backend.

### Step 4 — Upload Firebase Service Account (Secret File)

1. Download from: Firebase Console → Project Settings → Service Accounts → **Generate new private key**
2. In Render Dashboard → **Secret Files** → Add:
   - Filename: `firebase-service-account.json`
   - Mount Path: `./firebase-service-account.json`
   - Paste the downloaded JSON content

### Step 5 — Deploy

Click **Deploy**. Wait ~3–5 minutes. The live URL will be:
```
https://digvijay-blr-api.onrender.com
```
(or similar — Render generates the subdomain)

### Step 6 — Verify Deployment

Open in browser:
```
https://<your-render-url>/health
```
Expected response:
```json
{"status": "ok", "app": "Digvijay BLR API", "version": "2.0.0"}
```

Also check: `https://<your-render-url>/docs` — FastAPI Swagger UI should appear.

---

## Supabase: Verify Tables Exist

In Supabase Dashboard → Table Editor, confirm these tables exist:
- `users`
- `shipments`
- `shipment_permissions`
- `location_updates`
- `status_events`
- `companies`

If any are missing, run the contents of `backend/migrations/001_initial.sql` in the Supabase SQL Editor.

Also ensure an admin user exists:
```sql
SELECT * FROM users WHERE role = 'admin';
```
If empty, insert one:
```sql
INSERT INTO users (phone, name, role, is_active)
VALUES ('+919663469507', 'Admin', 'admin', true);
```

---

## Firebase: Add Test Phone Numbers (for OTP testing)

Real phone OTP with Firebase JS SDK requires adding test numbers:

1. Firebase Console → Authentication → Sign-in method → Phone
2. Scroll to **Phone numbers for testing** → Add number
3. Add: `+919663469507` with test code `123456`
4. Add any other numbers you want to test with

These bypass real SMS and work with the Firebase JS SDK's `fakeRecaptchaVerifier`.

---

## Frontend: Connect to Deployed Backend

### For physical device testing (Expo Go):

Set in `.env`:
```
EXPO_PUBLIC_API_URL=https://<your-render-url>
EXPO_PUBLIC_DEV_MOCK_AUTH=true
```

Then restart:
```bash
npx expo start --clear
```

Scan the QR with Expo Go — the app will use the live Render backend from any network.

### For ADB (USB cable, no network needed):
```bash
# Forward port from phone to laptop:
C:\platform-tools\adb.exe reverse tcp:8000 tcp:8000

# Set in .env:
EXPO_PUBLIC_API_URL=http://localhost:8000
```

---

## Frontend: Build Android APK

### One-time EAS setup (if not done):
```bash
npm install -g eas-cli
eas login
```

### Set production env vars in `.env`:
```
EXPO_PUBLIC_PROD_API_URL=https://<your-render-url>
EXPO_PUBLIC_DEV_MOCK_AUTH=false
```

### Build preview APK (sideloadable, no Play Store):
```bash
eas build --profile preview --platform android
```

This queues on Expo's cloud servers. Download the `.apk` when done and install on any Android device.

### Build production AAB (Play Store submission):
```bash
eas build --profile production --platform android
```

---

## Post-Deploy Checklist

- [ ] `GET /health` returns 200
- [ ] `GET /docs` loads Swagger UI
- [ ] Login with test phone number succeeds (Firebase test number)
- [ ] Admin dashboard loads shipments from Supabase
- [ ] Creating a new shipment works (POST /shipments)
- [ ] Phase transitions work (PUT /shipments/{id}/phase)
- [ ] Customer tracking screen loads correctly
- [ ] WebSocket connection opens without error (check browser console)
- [ ] Backend stays awake after first request (Render free tier spins down after 15min inactivity — first request after sleep takes ~30s)

---

## Known Limitations (Free Tier)

- **Render free tier** — service spins down after 15 minutes of inactivity. First request after sleep takes ~30 seconds. Upgrade to Starter ($7/mo) for always-on.
- **Supabase free tier** — 500MB database, 2GB bandwidth. Sufficient for initial launch.
- **Firebase free tier** — 10,000 SMS/month for real OTP (not needed while using test numbers).
