"""Tests for /shipments endpoints."""

import pytest


# ── POST /shipments ─────────────────────────────────────────────────────────

def test_create_shipment_success(client):
    payload = {
        "origin": "Bengaluru",
        "destination": "Delhi",
        "transport_mode": "air",
        "transport_number": "AI-202",
        "goods_description": "Test: electronics",
    }
    resp = client.post("/shipments", json=payload, headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "tracking_id" in data
    # Cleanup
    client.delete(f"/shipments/{data['id']}", headers={"Authorization": "Bearer dev-mock-token"})


def test_create_shipment_tracking_id_format(client):
    payload = {
        "origin": "Chennai",
        "destination": "Hyderabad",
        "transport_mode": "train",
        "transport_number": "EXP-500",
    }
    resp = client.post("/shipments", json=payload, headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 200
    tracking_id = resp.json()["tracking_id"]
    assert tracking_id.startswith("DGVJ-"), f"Expected DGVJ- prefix, got: {tracking_id}"
    assert len(tracking_id) == 13  # "DGVJ-" (5) + 8 chars
    # Cleanup
    client.delete(f"/shipments/{resp.json()['id']}", headers={"Authorization": "Bearer dev-mock-token"})


def test_create_shipment_starts_in_pickup_phase(client):
    payload = {
        "origin": "Pune",
        "destination": "Kolkata",
        "transport_mode": "train",
        "transport_number": "RAJ-101",
    }
    resp = client.post("/shipments", json=payload, headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 200
    assert resp.json()["current_phase"] == "pickup"
    # Cleanup
    client.delete(f"/shipments/{resp.json()['id']}", headers={"Authorization": "Bearer dev-mock-token"})


def test_create_shipment_requires_auth(client):
    payload = {
        "origin": "Bengaluru",
        "destination": "Delhi",
        "transport_mode": "train",
        "transport_number": "XX-999",
    }
    resp = client.post("/shipments", json=payload)
    assert resp.status_code == 403  # No auth header → forbidden


# ── GET /shipments ───────────────────────────────────────────────────────────

def test_get_shipments_returns_list(client, test_shipment):
    resp = client.get("/shipments", headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_shipments_includes_test_shipment(client, test_shipment):
    resp = client.get("/shipments", headers={"Authorization": "Bearer dev-mock-token"})
    ids = [s["id"] for s in resp.json()]
    assert test_shipment["id"] in ids


# ── GET /shipments/{id} ──────────────────────────────────────────────────────

def test_get_shipment_by_id(client, test_shipment):
    sid = test_shipment["id"]
    resp = client.get(f"/shipments/{sid}", headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == sid
    assert data["tracking_id"] == test_shipment["tracking_id"]


def test_get_shipment_includes_status_events(client, test_shipment):
    sid = test_shipment["id"]
    resp = client.get(f"/shipments/{sid}", headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 200
    assert "status_events" in resp.json()
    assert isinstance(resp.json()["status_events"], list)
    # 6 initial events are created on shipment creation
    assert len(resp.json()["status_events"]) == 6


def test_get_shipment_not_found(client):
    resp = client.get("/shipments/00000000-0000-0000-0000-000000000000",
                      headers={"Authorization": "Bearer dev-mock-token"})
    assert resp.status_code == 404


# ── PUT /shipments/{id}/phase ────────────────────────────────────────────────

def test_advance_phase_to_transit(client, test_shipment):
    sid = test_shipment["id"]
    resp = client.put(
        f"/shipments/{sid}/phase",
        json={"phase": "transit"},
        headers={"Authorization": "Bearer dev-mock-token"},
    )
    assert resp.status_code == 200
    assert resp.json()["phase"] == "transit"


def test_advance_phase_to_delivery(client, test_shipment):
    sid = test_shipment["id"]
    # Must advance through transit first
    client.put(f"/shipments/{sid}/phase", json={"phase": "transit"},
               headers={"Authorization": "Bearer dev-mock-token"})
    resp = client.put(
        f"/shipments/{sid}/phase",
        json={"phase": "delivery"},
        headers={"Authorization": "Bearer dev-mock-token"},
    )
    assert resp.status_code == 200
    assert resp.json()["phase"] == "delivery"


def test_advance_phase_to_completed_sets_completed_at(client, test_shipment):
    sid = test_shipment["id"]
    headers = {"Authorization": "Bearer dev-mock-token"}
    client.put(f"/shipments/{sid}/phase", json={"phase": "transit"}, headers=headers)
    client.put(f"/shipments/{sid}/phase", json={"phase": "delivery"}, headers=headers)
    client.put(f"/shipments/{sid}/phase", json={"phase": "completed"}, headers=headers)

    # Verify completed_at is set
    detail = client.get(f"/shipments/{sid}", headers=headers).json()
    assert detail["current_phase"] == "completed"
    assert detail["completed_at"] is not None


# ── POST /shipments/{id}/status-event ────────────────────────────────────────

def test_add_status_event(client, test_shipment):
    sid = test_shipment["id"]
    resp = client.post(
        f"/shipments/{sid}/status-event",
        json={"label": "Custom Update", "description": "Test status event from pytest"},
        headers={"Authorization": "Bearer dev-mock-token"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "Custom Update"
    assert data["shipment_id"] == sid
    assert data["is_completed"] is True
