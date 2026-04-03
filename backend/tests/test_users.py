"""Tests for /users endpoints."""

HEADERS = {"Authorization": "Bearer dev-mock-token"}


# ── GET /users/me ─────────────────────────────────────────────────────────────

def test_get_me_returns_200(client):
    resp = client.get("/users/me", headers=HEADERS)
    assert resp.status_code == 200


def test_get_me_returns_user_fields(client):
    resp = client.get("/users/me", headers=HEADERS)
    data = resp.json()
    assert "id" in data
    assert "phone" in data
    assert "role" in data


def test_get_me_role_is_admin(client):
    """dev-mock-token resolves to the admin user."""
    resp = client.get("/users/me", headers=HEADERS)
    assert resp.json()["role"] == "admin"


def test_get_me_requires_auth(client):
    resp = client.get("/users/me")
    assert resp.status_code == 403


# ── GET /users/employees ──────────────────────────────────────────────────────

def test_get_employees_returns_list(client):
    resp = client.get("/users/employees", headers=HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_employees_all_have_employee_role(client):
    resp = client.get("/users/employees", headers=HEADERS)
    for user in resp.json():
        assert user["role"] == "employee", f"Non-employee in /users/employees: {user}"


# ── GET /users/customers ──────────────────────────────────────────────────────

def test_get_customers_returns_list(client):
    resp = client.get("/users/customers", headers=HEADERS)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_customers_all_have_customer_role(client):
    resp = client.get("/users/customers", headers=HEADERS)
    for user in resp.json():
        assert user["role"] == "customer", f"Non-customer in /users/customers: {user}"


# ── PUT /users/me ─────────────────────────────────────────────────────────────

def test_update_me_name(client):
    # Get current name so we can restore it
    original = client.get("/users/me", headers=HEADERS).json()
    original_name = original.get("name") or "Admin"

    test_name = "pytest_update_test"
    resp = client.put("/users/me", json={"name": test_name}, headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["name"] == test_name

    # Restore original name
    client.put("/users/me", json={"name": original_name}, headers=HEADERS)


def test_update_me_empty_body_returns_user(client):
    """PUT /users/me with no updates just returns the current user unchanged."""
    resp = client.put("/users/me", json={}, headers=HEADERS)
    assert resp.status_code == 200
    assert "id" in resp.json()


# ── DELETE /users/{user_id} ───────────────────────────────────────────────────

def test_delete_user_removes_from_db(client):
    """DELETE hard-deletes the user row; they no longer appear in GET /users."""
    resp = client.post("/users", json={
        "name": "Delete Test User",
        "phone": "+919000000099",
        "role": "customer",
    }, headers=HEADERS)
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    del_resp = client.delete(f"/users/{user_id}", headers=HEADERS)
    assert del_resp.status_code == 200
    assert del_resp.json() == {"deleted": True}

    all_users = client.get("/users", headers=HEADERS).json()
    ids = [u["id"] for u in all_users]
    assert user_id not in ids


def test_delete_user_not_found(client):
    """DELETE with a non-existent user ID returns 404."""
    resp = client.delete("/users/00000000-0000-0000-0000-000000000000", headers=HEADERS)
    assert resp.status_code == 404
