"""Tests for email/password sign-up and Google/GitHub OAuth account flows."""

from __future__ import annotations

from fastapi.testclient import TestClient

from brigid.interfaces.web.app import create_web_app
from brigid.interfaces.web.auth import AccountStore
from conftest import ScriptedLLM

LOCAL = "http://127.0.0.1:8000"


def _client(world, tmp_path=None):
    app = world.make_app(ScriptedLLM())
    store = AccountStore(tmp_path / "auth.db") if tmp_path else AccountStore()
    return TestClient(
        create_web_app(app, world.env.principals(), account_store=store), base_url=LOCAL
    )


def test_email_signup_then_login_and_me(world, tmp_path):
    client = _client(world, tmp_path)

    signup = client.post(
        "/api/signup",
        json={"name": "Arya Pratama", "email": "arya@example.com", "password": "strongpassword1"},
    )
    assert signup.status_code == 200
    body = signup.json()
    assert body["token"]
    assert body["user"]["name"] == "Arya Pratama"
    assert body["user"]["role"] == "owner"
    assert client.cookies.get("brigid_session") == body["token"]

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Arya Pratama"

    client.post("/api/logout", json={})

    login = client.post(
        "/api/login",
        json={"email": "ARYA@example.com", "password": "strongpassword1"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["name"] == "Arya Pratama"

    bad_login = client.post(
        "/api/login",
        json={"email": "arya@example.com", "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401


def test_email_signup_rejects_duplicate_and_demo_emails(world):
    client = _client(world)

    demo_dup = client.post(
        "/api/signup",
        json={"name": "Fake Sari", "email": "owner@brigid.demo", "password": "strongpassword1"},
    )
    assert demo_dup.status_code == 409

    first = client.post(
        "/api/signup",
        json={"name": "Budi", "email": "budi@example.com", "password": "strongpassword1"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/signup",
        json={"name": "Budi 2", "email": "budi@example.com", "password": "strongpassword2"},
    )
    assert second.status_code == 409


def test_oauth_login_requires_prior_signup_for_google_and_github(world, tmp_path):
    client = _client(world, tmp_path)

    # Logging in before signing up must be rejected.
    google_login_before = client.post(
        "/api/oauth/complete",
        json={
            "provider": "google",
            "provider_user_id": "g-12345",
            "email": "arya.google@example.com",
            "name": "Arya Google",
            "intent": "login",
        },
    )
    assert google_login_before.status_code == 401
    assert "sign up first" in google_login_before.json()["detail"].lower()

    github_login_before = client.post(
        "/api/oauth/complete",
        json={
            "provider": "github",
            "provider_user_id": "gh-98765",
            "email": "arya.github@example.com",
            "name": "Arya GitHub",
            "intent": "login",
        },
    )
    assert github_login_before.status_code == 401
    assert "sign up first" in github_login_before.json()["detail"].lower()

    # Sign up with Google, then log in with Google.
    google_signup = client.post(
        "/api/oauth/complete",
        json={
            "provider": "google",
            "provider_user_id": "g-12345",
            "email": "arya.google@example.com",
            "name": "Arya Google",
            "intent": "signup",
        },
    )
    assert google_signup.status_code == 200
    assert google_signup.json()["user"]["name"] == "Arya Google"

    client.post("/api/logout", json={})

    google_login_after = client.post(
        "/api/oauth/complete",
        json={
            "provider": "google",
            "provider_user_id": "g-12345",
            "email": "arya.google@example.com",
            "name": "Arya Google",
            "intent": "login",
        },
    )
    assert google_login_after.status_code == 200
    assert google_login_after.json()["user"]["name"] == "Arya Google"

    # Sign up with GitHub, then log in with GitHub.
    github_signup = client.post(
        "/api/oauth/complete",
        json={
            "provider": "github",
            "provider_user_id": "gh-98765",
            "email": "arya.github@example.com",
            "name": "Arya GitHub",
            "intent": "signup",
        },
    )
    assert github_signup.status_code == 200
    assert github_signup.json()["user"]["name"] == "Arya GitHub"

    github_login_after = client.post(
        "/api/oauth/complete",
        json={
            "provider": "github",
            "provider_user_id": "gh-98765",
            "email": "arya.github@example.com",
            "name": "Arya GitHub",
            "intent": "login",
        },
    )
    assert github_login_after.status_code == 200
    assert github_login_after.json()["user"]["name"] == "Arya GitHub"


def test_account_store_persists_across_restarts(tmp_path):
    db_path = tmp_path / "auth.db"
    store1 = AccountStore(db_path)
    store1.create_email_account(
        name="Persisted User", email="persist@example.com", password="strongpassword1"
    )
    store1.signup_oauth_account(
        provider="github",
        provider_user_id="gh-111",
        email="gh@example.com",
        name="GH User",
    )

    store2 = AccountStore(db_path)
    assert store2.authenticate_email("persist@example.com", "strongpassword1") is not None
    assert store2.authenticate_oauth("github", "gh-111") is not None


def test_signup_preserves_selected_role_for_email_and_oauth(world, tmp_path):
    client = _client(world, tmp_path)

    email_signup = client.post(
        "/api/signup",
        json={
            "name": "Dewi Baru",
            "email": "dewi.baru@example.com",
            "password": "strongpassword1",
            "role": "bookkeeper",
        },
    )
    assert email_signup.status_code == 200
    assert email_signup.json()["user"]["role"] == "bookkeeper"

    client.post("/api/logout", json={})

    email_login = client.post(
        "/api/login",
        json={"email": "dewi.baru@example.com", "password": "strongpassword1"},
    )
    assert email_login.status_code == 200
    assert email_login.json()["user"]["role"] == "bookkeeper"

    oauth_signup = client.post(
        "/api/oauth/complete",
        json={
            "provider": "github",
            "provider_user_id": "gh-staff-1",
            "email": "staff.gh@example.com",
            "name": "Rudi GH",
            "intent": "signup",
            "role": "staff",
        },
    )
    assert oauth_signup.status_code == 200
    assert oauth_signup.json()["user"]["role"] == "staff"

    client.post("/api/logout", json={})

    oauth_login = client.post(
        "/api/oauth/complete",
        json={
            "provider": "github",
            "provider_user_id": "gh-staff-1",
            "email": "staff.gh@example.com",
            "name": "Rudi GH",
            "intent": "login",
        },
    )
    assert oauth_login.status_code == 200
    assert oauth_login.json()["user"]["role"] == "staff"


def test_oauth_prepare_prompts_role_only_for_new_signup(world, tmp_path):
    client = _client(world, tmp_path)

    # New user signing up via Google gets needs_role without creating account yet.
    prep_new = client.post(
        "/api/oauth/prepare",
        json={
            "provider": "google",
            "provider_user_id": "g-prep-1",
            "email": "new.google@example.com",
            "name": "New Google",
            "intent": "signup",
        },
    )
    assert prep_new.status_code == 200
    assert prep_new.json() == {
        "status": "needs_role",
        "provider": "google",
        "email": "new.google@example.com",
        "name": "New Google",
    }

    # Trying to log in before completing role selection is still refused.
    prep_login_before = client.post(
        "/api/oauth/prepare",
        json={
            "provider": "google",
            "provider_user_id": "g-prep-1",
            "email": "new.google@example.com",
            "name": "New Google",
            "intent": "login",
        },
    )
    assert prep_login_before.status_code == 401

    # Completing signup with selected role creates the account.
    complete = client.post(
        "/api/oauth/complete",
        json={
            "provider": "google",
            "provider_user_id": "g-prep-1",
            "email": "new.google@example.com",
            "name": "New Google",
            "intent": "signup",
            "role": "bookkeeper",
        },
    )
    assert complete.status_code == 200
    assert complete.json()["user"]["role"] == "bookkeeper"

    client.post("/api/logout", json={})

    # Returning Google signup skips role selection and authenticates immediately.
    prep_existing = client.post(
        "/api/oauth/prepare",
        json={
            "provider": "google",
            "provider_user_id": "g-prep-1",
            "email": "new.google@example.com",
            "name": "New Google",
            "intent": "signup",
        },
    )
    assert prep_existing.status_code == 200
    assert prep_existing.json()["status"] == "authenticated"
    assert prep_existing.json()["user"]["role"] == "bookkeeper"
