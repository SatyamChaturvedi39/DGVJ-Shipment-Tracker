# Manual Testing Guide — Digvijay BLR (Production)

Testing the live app against the deployed Render backend with real accounts.

---

## Prerequisites

### Backend (Render)
- Backend must be deployed and running at your Render URL
- Verify: open `https://<your-render-url>/health` — should return `{"status":"ok","version":"1.0.0"}`

**Required Supabase migrations (run once in SQL Editor):**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE status_events ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 99;
```

**Required Render environment variables:**
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
JWT_SECRET_KEY=<random 32+ char string>
```

### App (APK)
- Build and install the preview APK:
  ```bash
  # Set in .env before building:
  EXPO_PUBLIC_PROD_API_URL=https://<your-render-url>
  EXPO_PUBLIC_DEV_MOCK_AUTH=false

  eas build --profile preview --platform android
  ```
- Install the `.apk` on your Android device

### Accounts needed before testing
Pre-register these users in Supabase (via the Admin Team screen in a dev build, or directly in Supabase SQL editor). **Every user must have a PIN set by the admin.**

| Phone | Name | Role | PIN |
|-------|------|------|-----|
| +919663469507 | Admin | admin | set via Swagger /auth/set-pin |
| +91XXXXXXXXXX | Ravi Kumar | employee | set when creating |
| +91XXXXXXXXXX | Suresh Nair | employee | set when creating |
| +91XXXXXXXXXX | Sharma Traders | customer | set when creating |

**To set admin PIN (first time only):**
1. Open `https://<your-render-url>/docs`
2. POST `/auth/set-pin` with header `Authorization: Bearer dev-mock-token` and body `{"new_pin": "1234"}`

### How to switch between accounts during testing

You will need to switch between Admin, Employee, and Customer accounts frequently. Here is the exact flow each time:

**To sign out (from any role):**
- **Admin:** Dashboard / New Shipment / Archive tabs → tap the **Sign Out** button in the top-right header. OR go to the Team tab → tap **Sign Out** in the custom header.
- **Employee:** My Jobs tab → tap **Sign Out** in the top-right header.
- **Customer:** Profile tab (rightmost tab) → scroll to bottom → tap **Sign Out**.

All sign-outs show a confirmation alert — tap "Sign Out" to confirm. App returns to the login screen.

**To sign in as a different account:**
1. Enter the 10-digit phone number for that account (without the +91 prefix — the app adds it)
2. Tap **Continue →**
3. Enter the 4-digit PIN for that account
4. App navigates to the correct role dashboard automatically

**Tip for Part 5 (end-to-end flow):** You will switch between Admin → Employee (Ravi) → Customer → Employee (Ravi) → Admin → Employee (Suresh) → Customer → Employee (Suresh). Keep the phone numbers and PINs for all 4 accounts written down before you start.

---

## Part 1 — Authentication

### 1A. Login with PIN

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open app | Circular "D" emblem, DIGVIJAY wordmark, BANGALORE badge. No dev role buttons. |
| 2 | Enter admin phone | Type 10 digits in the +91 field |
| 3 | Tap "Continue →" | Navigates to PIN screen |
| 4 | Enter 4-digit PIN | Auto-submits on 4th digit |
| 5 | Correct PIN | Redirects to Admin Dashboard |
| 6 | Sign out | Team tab → Sign Out |
| 7 | Repeat for employee phone | Redirects to My Jobs |
| 8 | Repeat for customer phone | Redirects to My Shipments |

### 1B. Wrong PIN

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enter correct phone, wrong PIN | "Incorrect PIN. Please try again." shown on PIN screen |
| 2 | PIN boxes clear | User can re-enter — stays on PIN screen, no redirect |

### 1C. First-time login (no PIN set yet)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin creates a new user but doesn't set their PIN | Or create user via Team screen — PIN is always set there, so for this test: manually clear `pin_hash` in Supabase for a test user |
| 2 | Enter that user's phone → "Continue →" | App navigates directly to **Setup PIN** screen (not the verify/enter-PIN screen) |
| 3 | Set a 4-digit PIN | Confirm PIN → account activated → dashboard loads |

### 1D. Phone not registered

| Step | Action | Expected |
|------|--------|----------|
| 1 | Enter a phone not in Supabase | Tap "Continue →" |
| 2 | Error appears on login screen | "Your number is not registered. Contact Digvijay Express." — no navigation |

### 1E. Deactivated account

| Step | Action | Expected |
|------|--------|----------|
| 1 | Deactivate an employee via Admin Team screen | |
| 2 | That employee tries to log in with correct PIN | Error: "Access denied. Contact Digvijay Express to get access." |

### 1F. Session persistence

| Step | Action | Expected |
|------|--------|----------|
| 1 | Log in as any role | Dashboard/jobs screen loads |
| 2 | Kill the app fully | |
| 3 | Reopen app | Goes directly to the correct role screen — no login required |

---

## Part 2 — Admin Role

Log in as the admin phone number.

### 2A. Dashboard

| Step | Action | Expected |
|------|--------|----------|
| 1 | Stats row | Active, In Transit, Delivered Today counts are accurate |
| 2 | Shipment cards | Left border color matches phase (amber = pickup/delivery, blue = transit, purple = with carrier) |
| 3 | Phase badges | Correct labels: "Pickup", "In Transit", "With Carrier", "Out for Delivery", "Completed" |
| 4 | ETA display | Shows "1 May 2026" format — not raw "2026-05-01" |
| 5 | Pull to refresh | List reloads from server |

### 2B. Create Shipment

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tap + tab | Form loads |
| 2 | Fill all fields | Origin, Destination, mode toggle, transport #, ETA date + time via date picker |
| 3 | Pickup Driver | Dropdown shows real employees from DB → select one |
| 4 | Customer Access | Modal shows real customers from DB → select one or more → "N customers selected" |
| 5 | Submit | "Create Shipment →" → success overlay → dashboard |
| 6 | Verify | New shipment at top of active list with "Pickup" phase |

**Validation:**
- Empty Origin → "Origin is required"
- No ETA Date → error on submit
- No driver → "Pickup Driver is required"

### 2C. Shipment Detail

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tap any active shipment | Detail screen opens |
| 2 | Timeline order | Picked Up → Heading to Carrier → Handed to Carrier → Out for Delivery → Delivered |
| 3 | **KEY CHECK** | Completed events show real date like "3 Apr 2026, 9:17 pm" — **NOT "Invalid Date"** |
| 4 | Pending events | Show "Pending" — not a date |
| 5 | Add status update | "+ Add Status Update" → bottom sheet → fill fields → "Add Update" → event appears |
| 6 | Advance phase | "Mark as In Transit →" → confirm alert → badge updates |
| 7 | Completed state | Green banner with delivery date, no advance button |
| 8 | **Edit Tracking ID** | Tap the tracking ID in the header card → inline edit row with TextInput appears |
| 9 | Save tracking ID | Type new ID → tap "Save" → ID updates in header, edit row closes |
| 10 | Cancel edit | Tap "Cancel" → original ID restored, edit row closes |

### 2D. Archive

| Step | Action | Expected |
|------|--------|----------|
| 1 | Completed shipments | Appear in list sorted newest first |
| 2 | Completed date | Shows "3 Apr 2026, 5:30 pm" — not raw "2026-04-03" |
| 3 | Filter chips | "All", "✈ Air", "🚂 Train" — tap each, count updates correctly |
| 4 | Count label | Shows "N results" outside the scrollable chip row (not hidden off-screen) |
| 5 | Search | Filters by tracking ID, origin, or destination |
| 6 | Tap row | Opens read-only detail (no advance button) |
| 7 | Pull to refresh | Reloads list |

### 2E. Team Screen

| Step | Action | Expected |
|------|--------|----------|
| 1 | Employees / Customers tabs | Both show counts matching DB |
| 2 | Add Employee | "+ Add Employee" → name + 10-digit phone + 4-digit PIN → "Add" → appears instantly |
| 3 | PIN required | Submitting without PIN → inline error "PIN must be 4 digits" |
| 4 | PIN not 4 digits | 3 or 5 digit PIN → validation error |
| 5 | Duplicate phone | Same phone again → "This phone number is already registered" |
| 6 | Deactivate user | Tap row → Deactivate → user at 0.6 opacity |
| 7 | Reactivate | Tap row → Reactivate → full opacity |
| 8 | Delete | Tap row → Delete → confirm → removed immediately from list |
| 9 | Sign Out | Header button → confirmation → login screen |

---

## Part 3 — Employee Role

Log in as an employee phone number.

### 3A. My Jobs

| Step | Action | Expected |
|------|--------|----------|
| 1 | Employee name | Shown in header |
| 2 | Active tab | Only shipments assigned to this employee in active phases |
| 3 | Pickup driver | Sees shipments in "pickup" and "transit" phases only |
| 4 | Delivery driver | Sees shipments in "handed_to_carrier" and "out_for_delivery" phases only |
| 5 | Role badge | Amber "PICKUP DRIVER" or blue "DELIVERY DRIVER" |
| 6 | ETA | "1 May 2026" format |
| 7 | Completed tab | Only this employee's completed shipments |

### 3B. Job Detail — Pickup Driver Flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Tap active job | Job Detail opens with 5-dot phase bar |
| 2 | ETA | "1 May 2026" format in route section |
| 3 | Timeline | No "Invalid Date" on any completed event |
| 4 | YOUR NEXT ACTION | Card at top with action button |
| 5 | GPS section | "START TRACKING" button visible (pickup phase, pickup driver) |
| 6 | Start tracking | Pulsing green dot + coordinates update |
| 7 | **Mark as Picked Up** | Tap "Mark as Picked Up 📦" → confirm → screen stays open → phase badge updates to "In Transit" → GPS auto-starts (no manual tap needed) |
| 8 | **No "Phase Updated by Admin" popup** | Immediately after step 7, NO alert popup should appear. Popup only comes from admin-initiated changes. |
| 9 | Hand to carrier | Tap "Mark as Handed to Carrier →" → confirm → GPS stops → navigates back to My Jobs |
| 10 | Shipment leaves Active tab | After phase → handed_to_carrier, this driver's Active tab is empty for this shipment |

### 3C. Job Detail — Delivery Driver Flow

| Step | Action | Expected |
|------|--------|----------|
| 1 | Admin must set delivery_employee_id | Via Team screen or directly |
| 2 | Shipment appears | In delivery driver's Active tab at "handed_to_carrier" phase |
| 3 | Wait card | Purple "With Carrier" card shown while in handed_to_carrier phase |
| 4 | Advance to out_for_delivery | Admin does this from shipment detail |
| 5 | GPS section appears | "START TRACKING" visible for delivery driver in out_for_delivery phase |
| 6 | Start tracking | Green dot, coordinates update |
| 7 | Mark delivered | "Mark as Delivered ✓" → confirm → phase → "completed" |
| 8 | Job moves to Completed tab | Active tab empty for this shipment |

---

## Part 4 — Customer Role

Log in as a customer phone number.

### 4A. My Shipments

| Step | Action | Expected |
|------|--------|----------|
| 1 | Active tab (default) | Only in-progress shipments (not completed) for this customer |
| 2 | History tab | Only completed shipments for this customer |
| 3 | Tab counts | Numbers next to "Active" / "History" show correct counts |
| 4 | Empty states | "No active shipments" or "No completed shipments" (tab-specific, not generic) |
| 5 | ETA | "1 May 2026" format |
| 6 | Search | Filters within the selected tab by tracking ID or city |

### 4B. Shipment Tracking — Phase by Phase

**Pickup / Transit phase:**

| Step | Action | Expected |
|------|--------|----------|
| 1 | Header | Tracking ID, status text, 4-dot progress bar |
| 2 | ETA card | Large formatted date + time |
| 3 | Live Map section | Appears (pickup or transit phase) |
| 4 | Driver not tracking | Placeholder icon + "Tracking will begin when driver starts their journey" |
| 5 | Driver starts GPS | Google Maps appears with red marker |
| 6 | "Driver is on the way" card | Shows below map with last-updated time (HH:MM) |
| 7 | Driver moves | Marker animates smoothly (800ms) — does NOT jump |

**Handed to Carrier phase:**

| Step | Action | Expected |
|------|--------|----------|
| 8 | Transit card | Large ✈ or 🚂 icon (56px), transport number in monospace, route |
| 9 | Map | Gone — no live tracking while with carrier |
| 10 | Admin status updates | Show as mini-events below transit card |

**Out for Delivery phase:**

| Step | Action | Expected |
|------|--------|----------|
| 11 | Live Map reappears | Delivery driver's GPS shown |

**Completed:**

| Step | Action | Expected |
|------|--------|----------|
| 12 | ETA card replaced | Green "Shipment Delivered" card with full delivery date |
| 13 | No map | Live tracking section gone |

**Admin notes vs Status Timeline:**

| Step | Action | Expected |
|------|--------|----------|
| 14 | Admin adds a status update to a shipment | |
| 15 | Customer opens that shipment | Admin-added updates appear in a **separate amber card** "UPDATES FROM DIGVIJAY EXPRESS" — NOT in the main status timeline |
| 16 | Main "Status Timeline" | Contains only the 5 system events (Picked Up, Heading to Carrier, etc.) — no admin notes mixed in |
| 17 | If no admin notes | Amber card does not appear at all |

**Status Timeline (all phases):**

| Step | Action | Expected |
|------|--------|----------|
| 18 | Timeline order | Picked Up → Heading to Carrier → Handed to Carrier → Out for Delivery → Delivered |
| 19 | **KEY CHECK** | Completed events: real date like "3 Apr 2026, 9:17 pm" — **NOT "Invalid Date"** |
| 20 | Current event | Red pulsing dot + "Pending" text |
| 21 | Future events | Gray outlined dot + "Pending" |

**ETA overdue:**

| Step | Action | Expected |
|------|--------|----------|
| 18 | Shipment with past ETA, not completed | Amber border on ETA card + "Contact Digvijay Express for updates" |

**Details section:**

| Step | Action | Expected |
|------|--------|----------|
| 19 | Tap "Shipment Details ▼" | Expands: origin, destination, transport, goods, notes |
| 20 | Tap again | Collapses |

### 4C. Profile

| Step | Action | Expected |
|------|--------|----------|
| 1 | Name + Company | Editable |
| 2 | Phone | Read-only, "Cannot be changed" |
| 3 | Save | "Saving…" → success alert → fields retain new values |
| 4 | Change PIN | Tap "Change PIN" row → modal opens |
| 5 | New PIN + Confirm | Enter matching 4-digit PINs → "Save PIN" → success |
| 6 | Mismatched PINs | "PINs do not match" inline error |
| 7 | Log in with new PIN | Sign out → sign in again with the new PIN → should succeed |
| 8 | Sign out | Confirmation → login screen |

---

## Part 5 — Full End-to-End Flow

Run this once to confirm the entire shipment lifecycle works in production.

```
1. Admin: Create shipment
   Origin: Bengaluru | Destination: Mumbai | Air | AI-101
   ETA: pick a future date via date picker
   Assign pickup driver: Ravi Kumar
   Customer access: Sharma Traders
   → Submit → shipment created

2. Admin: Verify Dashboard
   → New shipment visible with amber "Pickup" badge

3. Employee (Ravi Kumar — pickup driver): Log in with phone + PIN
   → My Jobs: Shipment in Active tab with amber "Pickup" badge, "PICKUP DRIVER" badge

4. Employee: Open job → Start GPS tracking
   → Green pulsing dot, coordinates showing

5. Customer (Sharma Traders): Log in with phone + PIN
   → My Shipments → tap shipment
   → Pickup section visible with Google Map + red marker
   → "🚗 Driver is on the way" card

6. Employee: Mark as Picked Up
   → Phase → "In Transit" (GPS still active — driving to airport)
   → Customer: map still shows driver

7. Employee: Mark as Handed to Carrier
   → GPS stops
   → Phase → "handed_to_carrier"
   → Customer: transit card with ✈ + AI-101, no map

8. Admin: Add status update "Arrived at Mumbai Airport"
   → Customer: new event appears in status timeline

9. Admin: Advance phase to Out for Delivery
   (Assign Suresh Nair as delivery driver first)

10. Employee (Suresh Nair — delivery driver): Log in with phone + PIN
    → My Jobs: Shipment in Active tab with amber "Out for Delivery" badge, "DELIVERY DRIVER" badge
    → Open job → Start GPS

11. Customer: Live map reappears with delivery driver's location

12. Employee: Mark as Delivered
    → Phase → "completed"
    → My Jobs: shipment moves to Completed tab

13. Final verification:
    ✓ Admin Dashboard: shipment gone from active list
    ✓ Admin Archive: shipment in list with formatted date (not "Invalid Date")
    ✓ Customer Tracking: green "Shipment Delivered" card with timestamp
    ✓ Status timeline (admin + customer): all 5 events have real dates — none say "Invalid Date"
    ✓ Timeline order: Picked Up first, Delivered last
```

---

## Part 6 — Quick Regression Checklist

After any code deploy, run these checks in under 5 minutes:

- [ ] Login screen loads — "D" emblem, DIGVIJAY wordmark, no dev buttons
- [ ] Phone not in DB → error on login screen (not navigated away)
- [ ] Phone with no PIN → goes to **Setup PIN** screen (not Enter PIN)
- [ ] Phone with PIN → goes to Enter PIN screen
- [ ] Correct PIN → correct role dashboard loads
- [ ] Wrong PIN → error shown on PIN screen, stays on PIN screen
- [ ] App killed and reopened → session restored, no login required
- [ ] Admin: tap any shipment → timeline has no "Invalid Date"
- [ ] Admin: tap tracking ID in detail → inline edit row appears → save updates it
- [ ] Admin: Archive → filter chips + count visible together (count not cut off)
- [ ] Admin: Team → Add user with 4-digit PIN → user appears
- [ ] Employee: Mark as Picked Up → stays on screen, GPS auto-starts, no "Phase Updated" popup
- [ ] Customer: My Shipments → Active and History tabs both work
- [ ] Customer: tap any shipment → admin notes in amber card, NOT in main timeline
- [ ] Customer: tap any shipment → timeline has no "Invalid Date"
- [ ] Customer: Profile → Change PIN row visible and tappable
- [ ] ETA shows as "1 May 2026" (not "2026-05-01")
- [ ] Phase badges have correct labels (not blank)
- [ ] Archive completed date is formatted (not raw ISO)
