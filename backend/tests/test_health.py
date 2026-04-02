"""Tests for GET /health endpoint."""


def test_health_returns_200(client):
    resp = client.get("/health")
    assert resp.status_code == 200


def test_health_returns_ok_status(client):
    resp = client.get("/health")
    data = resp.json()
    assert data["status"] == "ok"


def test_health_includes_app_name(client):
    resp = client.get("/health")
    data = resp.json()
    assert "app" in data
    assert "Digvijay" in data["app"]
