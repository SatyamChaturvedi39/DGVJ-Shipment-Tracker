"""
Shared fixtures for all backend tests.

Auth strategy:
  - FastAPI's dependency_overrides replaces get_current_user with a mock that
    returns TEST_ADMIN_USER (role="admin") for all requests that carry any
    Bearer token.
  - Requests with NO Authorization header still get 403 from HTTPBearer (auth
    is not bypassed at the transport level).
  - This means "requires auth" tests still work correctly.

Database:
  - A test admin row is inserted into Supabase at session start so that
    shipments.created_by FK constraints are satisfied.
  - All test data is cleaned up in teardown.
"""

import sys
import os

# Add backend/ to sys.path so module imports resolve (e.g. "from database import supabase")
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient

import dependencies
from main import app
from database import supabase
from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Shared auth headers ───────────────────────────────────────────────────────
# Any valid Bearer format is fine; the mock ignores the token value.
HEADERS = {"Authorization": "Bearer pytest-token"}

# ── Test admin user (inserted into Supabase so FK constraints are met) ────────
TEST_ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
TEST_ADMIN_USER = {
    "id": TEST_ADMIN_ID,
    "phone": "+910000000001",           # clearly fake phone
    "name": "Pytest Admin",
    "role": "admin",
    "firebase_uid": "pytest-firebase-admin-001",
    "company_name": None,
    "is_active": True,
}


# ── Dependency override ───────────────────────────────────────────────────────

async def _mock_get_current_user(
    _credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
):
    """
    Keeps HTTPBearer active so requests without an Authorization header still
    get 403. Once a Bearer token is present (any value), returns TEST_ADMIN_USER
    without hitting Firebase or Supabase.
    """
    return TEST_ADMIN_USER


app.dependency_overrides[dependencies.get_current_user] = _mock_get_current_user


# ── Session-scoped DB setup / teardown ───────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """
    Insert test admin into Supabase if absent.
    On teardown, delete all shipments the test admin created, then the user.
    """
    existing = supabase.table("users").select("id").eq("id", TEST_ADMIN_ID).execute()
    if not existing.data:
        supabase.table("users").insert(TEST_ADMIN_USER).execute()

    yield

    # Cascade deletes handle status_events / shipment_permissions automatically.
    supabase.table("shipments").delete().eq("created_by", TEST_ADMIN_ID).execute()
    supabase.table("users").delete().eq("id", TEST_ADMIN_ID).execute()


# ── Shared TestClient ─────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def client(setup_test_db):  # noqa: ARG001 — ensures DB setup runs before client is created
    """Single TestClient reused across the whole test session."""
    with TestClient(app) as c:
        yield c


# ── Per-test shipment fixture ─────────────────────────────────────────────────

@pytest.fixture
def test_shipment(client):
    """
    Creates a real shipment in Supabase before each test and deletes it after.
    Tests that need an existing shipment should declare this fixture.
    """
    payload = {
        "origin": "Bengaluru",
        "destination": "Mumbai",
        "transport_mode": "train",
        "transport_number": "TEST-9999",
        "goods_description": "Automated test goods — safe to delete",
        "eta_date": "2026-05-01",
        "eta_time": "14:00",
        "notes": "Created by pytest — delete after test",
    }
    resp = client.post("/shipments", json=payload, headers=HEADERS)
    assert resp.status_code == 200, f"Fixture: failed to create test shipment: {resp.text}"
    shipment = resp.json()
    yield shipment
    client.delete(f"/shipments/{shipment['id']}", headers=HEADERS)
