"""
Digvijay BLR — Full Lifecycle Integration Check
================================================
Runs against a live backend at http://localhost:8000.

Usage:
    cd C:/SattyGithub/DGVJ-Shipment-Tracker
    python backend/tests/integration_check.py

Prerequisites:
    - Backend is running: uvicorn main:app --reload  (from backend/ dir)
    - Supabase DB has at least one user with role='admin'
    - venv is activated (httpx and websockets are installed)

Auth:
    All requests use dev-mock-token (resolves to admin in the DB).
    POST /location/update is employee-only → marked as KNOWN_SKIP.
"""

import asyncio
import json
import sys
import httpx
import websockets

BASE = "http://localhost:8000"
WS_BASE = "ws://localhost:8000"
HEADERS = {"Authorization": "Bearer dev-mock-token"}

passed = 0
failed = 0
skipped = 0


def _ok(step: str, detail: str = ""):
    global passed
    passed += 1
    suffix = f"  →  {detail}" if detail else ""
    print(f"  PASS  {step}{suffix}")


def _fail(step: str, detail: str = ""):
    global failed
    failed += 1
    suffix = f"  →  {detail}" if detail else ""
    print(f"  FAIL  {step}{suffix}")


def _skip(step: str, reason: str = ""):
    global skipped
    skipped += 1
    suffix = f"  (KNOWN SKIP: {reason})" if reason else ""
    print(f"  SKIP  {step}{suffix}")


def check_server(client: httpx.Client) -> bool:
    try:
        r = client.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def run_checks(client: httpx.Client) -> str | None:
    """
    Returns the shipment_id created during the run, or None if creation failed.
    """
    shipment_id = None

    # ── Step 1: GET /health ─────────────────────────────────────────────────
    print("\n── Health Check ──────────────────────────────────────────────────")
    try:
        r = client.get(f"{BASE}/health")
        if r.status_code == 200 and r.json().get("status") == "ok":
            _ok("GET /health", r.json())
        else:
            _fail("GET /health", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("GET /health", str(e))

    # ── Step 2: GET /users/me ───────────────────────────────────────────────
    print("\n── Auth / Users ──────────────────────────────────────────────────")
    try:
        r = client.get(f"{BASE}/users/me", headers=HEADERS)
        if r.status_code == 200 and r.json().get("role") == "admin":
            _ok("GET /users/me", f"role={r.json()['role']}, id={r.json()['id'][:8]}…")
        else:
            _fail("GET /users/me", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("GET /users/me", str(e))

    try:
        r = client.get(f"{BASE}/users/employees", headers=HEADERS)
        if r.status_code == 200:
            _ok("GET /users/employees", f"{len(r.json())} employee(s)")
        else:
            _fail("GET /users/employees", f"status={r.status_code}")
    except Exception as e:
        _fail("GET /users/employees", str(e))

    try:
        r = client.get(f"{BASE}/users/customers", headers=HEADERS)
        if r.status_code == 200:
            _ok("GET /users/customers", f"{len(r.json())} customer(s)")
        else:
            _fail("GET /users/customers", f"status={r.status_code}")
    except Exception as e:
        _fail("GET /users/customers", str(e))

    # ── Step 3: POST /shipments ─────────────────────────────────────────────
    print("\n── Shipment Lifecycle ────────────────────────────────────────────")
    try:
        payload = {
            "origin": "Bengaluru",
            "destination": "Mumbai",
            "transport_mode": "train",
            "transport_number": "INTEG-TEST-001",
            "goods_description": "Integration test shipment — safe to delete",
            "eta_date": "2026-05-10",
            "eta_time": "10:00",
        }
        r = client.post(f"{BASE}/shipments", json=payload, headers=HEADERS)
        if r.status_code == 200:
            data = r.json()
            shipment_id = data["id"]
            tracking_id = data["tracking_id"]
            if tracking_id.startswith("DGVJ-"):
                _ok("POST /shipments", f"id={shipment_id[:8]}… tracking={tracking_id}")
            else:
                _fail("POST /shipments", f"tracking_id missing DGVJ- prefix: {tracking_id}")
        else:
            _fail("POST /shipments", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("POST /shipments", str(e))

    if not shipment_id:
        print("\n  Cannot continue lifecycle tests — shipment creation failed.")
        return None

    # ── Step 4: GET /shipments ──────────────────────────────────────────────
    try:
        r = client.get(f"{BASE}/shipments", headers=HEADERS)
        if r.status_code == 200 and isinstance(r.json(), list):
            ids = [s["id"] for s in r.json()]
            if shipment_id in ids:
                _ok("GET /shipments", f"{len(r.json())} shipment(s) returned")
            else:
                _fail("GET /shipments", "new shipment not in list")
        else:
            _fail("GET /shipments", f"status={r.status_code}")
    except Exception as e:
        _fail("GET /shipments", str(e))

    # ── Step 5: GET /shipments/{id} ─────────────────────────────────────────
    try:
        r = client.get(f"{BASE}/shipments/{shipment_id}", headers=HEADERS)
        if r.status_code == 200:
            detail = r.json()
            events = detail.get("status_events", [])
            _ok(f"GET /shipments/{{id}}", f"phase={detail['current_phase']}, events={len(events)}")
        else:
            _fail(f"GET /shipments/{{id}}", f"status={r.status_code}")
    except Exception as e:
        _fail(f"GET /shipments/{{id}}", str(e))

    # ── Step 6: POST /location/update (KNOWN SKIP) ──────────────────────────
    print("\n── Location ──────────────────────────────────────────────────────")
    _skip(
        "POST /location/update",
        "requires employee role; dev-mock-token resolves to admin → 403 by design",
    )

    # ── Step 7: GET /location/{id}/latest (no data yet) ─────────────────────
    try:
        r = client.get(f"{BASE}/location/{shipment_id}/latest", headers=HEADERS)
        if r.status_code == 200 and r.json() is None:
            _ok("GET /location/{id}/latest", "returns null (no location data yet — expected)")
        elif r.status_code == 200:
            _ok("GET /location/{id}/latest", f"location={r.json()}")
        else:
            _fail("GET /location/{id}/latest", f"status={r.status_code}")
    except Exception as e:
        _fail("GET /location/{id}/latest", str(e))

    # ── Step 8: PUT /shipments/{id}/phase → transit ─────────────────────────
    print("\n── Phase Transitions ─────────────────────────────────────────────")
    try:
        r = client.put(f"{BASE}/shipments/{shipment_id}/phase",
                       json={"phase": "transit"}, headers=HEADERS)
        if r.status_code == 200 and r.json()["phase"] == "transit":
            _ok("PUT phase → transit")
        else:
            _fail("PUT phase → transit", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("PUT phase → transit", str(e))

    # ── Step 9: POST /shipments/{id}/status-event ────────────────────────────
    try:
        r = client.post(
            f"{BASE}/shipments/{shipment_id}/status-event",
            json={"label": "Departed Bengaluru", "description": "Train departed Yeshwanthpur station"},
            headers=HEADERS,
        )
        if r.status_code == 200 and r.json()["label"] == "Departed Bengaluru":
            _ok("POST /shipments/{id}/status-event", f"id={r.json()['id'][:8]}…")
        else:
            _fail("POST /shipments/{id}/status-event", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("POST /shipments/{id}/status-event", str(e))

    # ── Step 10: PUT /shipments/{id}/phase → delivery ────────────────────────
    try:
        r = client.put(f"{BASE}/shipments/{shipment_id}/phase",
                       json={"phase": "delivery"}, headers=HEADERS)
        if r.status_code == 200 and r.json()["phase"] == "delivery":
            _ok("PUT phase → delivery")
        else:
            _fail("PUT phase → delivery", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("PUT phase → delivery", str(e))

    # ── Step 11: PUT /shipments/{id}/phase → completed ───────────────────────
    try:
        r = client.put(f"{BASE}/shipments/{shipment_id}/phase",
                       json={"phase": "completed"}, headers=HEADERS)
        if r.status_code == 200 and r.json()["phase"] == "completed":
            _ok("PUT phase → completed")
        else:
            _fail("PUT phase → completed", f"status={r.status_code} body={r.text}")
    except Exception as e:
        _fail("PUT phase → completed", str(e))

    # ── Step 12: Verify completed_at is set ──────────────────────────────────
    try:
        r = client.get(f"{BASE}/shipments/{shipment_id}", headers=HEADERS)
        data = r.json()
        if data["current_phase"] == "completed" and data.get("completed_at"):
            _ok("Verify completed_at set", f"completed_at={data['completed_at'][:19]}")
        else:
            _fail("Verify completed_at set",
                  f"phase={data.get('current_phase')}, completed_at={data.get('completed_at')}")
    except Exception as e:
        _fail("Verify completed_at set", str(e))

    return shipment_id


async def run_websocket_test(shipment_id: str):
    """
    WebSocket test:
    1. Connect to /ws/{shipment_id}
    2. Expect an immediate phase_change message (sent on connect)
    3. Verify message structure
    """
    print("\n── WebSocket ─────────────────────────────────────────────────────")
    uri = f"{WS_BASE}/ws/{shipment_id}"
    try:
        async with websockets.connect(uri) as ws:
            # The handler sends phase_change immediately on connect
            raw = await asyncio.wait_for(ws.recv(), timeout=5)
            msg = json.loads(raw)
            if msg.get("type") == "phase_change" and "phase" in msg:
                _ok("WebSocket connect + receive phase_change",
                    f"type={msg['type']}, phase={msg['phase']}")
            else:
                _fail("WebSocket receive phase_change",
                      f"unexpected message: {msg}")
    except asyncio.TimeoutError:
        _fail("WebSocket receive phase_change", "timed out after 5 seconds")
    except Exception as e:
        _fail("WebSocket connect", str(e))


def cleanup(client: httpx.Client, shipment_id: str):
    try:
        r = client.delete(f"{BASE}/shipments/{shipment_id}", headers=HEADERS)
        if r.status_code == 200:
            print(f"\n  Cleanup: deleted test shipment {shipment_id[:8]}…")
        else:
            print(f"\n  Cleanup WARNING: DELETE returned {r.status_code}")
    except Exception as e:
        print(f"\n  Cleanup ERROR: {e}")


def main():
    print("=" * 65)
    print("  Digvijay BLR — Integration Check")
    print("  Target: http://localhost:8000")
    print("=" * 65)

    with httpx.Client(timeout=15) as client:
        if not check_server(client):
            print("\n  ERROR: Backend is not running at http://localhost:8000")
            print("  Start it with: cd backend && uvicorn main:app --reload")
            sys.exit(1)

        shipment_id = run_checks(client)

        if shipment_id:
            asyncio.run(run_websocket_test(shipment_id))
            cleanup(client, shipment_id)
        else:
            print("\n  Skipping WebSocket test (no shipment created).")

    total = passed + failed + skipped
    print("\n" + "=" * 65)
    print(f"  Results: {passed} PASS  |  {failed} FAIL  |  {skipped} SKIP  |  {total} total")
    if failed == 0:
        print("  Status: ALL CHECKS PASSED")
    else:
        print(f"  Status: {failed} CHECK(S) FAILED — review output above")
    print("=" * 65)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
