"""
Tests for /location endpoints.

NOTE: POST /location/update requires employee role.
      dev-mock-token resolves to admin → returns 403 (expected, by design).
      GET /location/{id}/latest uses get_current_user (any role) → works fine.
"""

HEADERS = {"Authorization": "Bearer dev-mock-token"}


def test_location_update_returns_403_for_admin(client, test_shipment):
    """
    Confirms that POST /location/update correctly rejects admin tokens.
    In production, real employee tokens will pass this check.
    See CLAUDE.md Known Issue #4.
    """
    resp = client.post(
        "/location/update",
        json={"shipment_id": test_shipment["id"], "lat": 12.9716, "lng": 77.5946},
        headers=HEADERS,
    )
    assert resp.status_code == 403, (
        "Expected 403 for admin token on employee-only endpoint. "
        f"Got {resp.status_code}: {resp.text}"
    )


def test_location_update_requires_auth(client, test_shipment):
    resp = client.post(
        "/location/update",
        json={"shipment_id": test_shipment["id"], "lat": 12.9716, "lng": 77.5946},
    )
    assert resp.status_code == 403


def test_get_latest_location_returns_none_when_empty(client, test_shipment):
    """Fresh shipment has no location data — endpoint returns null/None."""
    sid = test_shipment["id"]
    resp = client.get(f"/location/{sid}/latest", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json() is None


def test_get_latest_location_requires_auth(client, test_shipment):
    sid = test_shipment["id"]
    resp = client.get(f"/location/{sid}/latest")
    assert resp.status_code == 403
