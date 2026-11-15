"""The session login and the read-only web API added in Phase 3."""

import datetime as dt

import pytest
from fastapi.testclient import TestClient

from brigid.interfaces.web.app import create_web_app
from conftest import ScriptedLLM, flagged_invoice_ids, read_csv, say

LOCAL = "http://127.0.0.1:8000"
PASSWORD = "brigid123"
EMAILS = {
    "owner": "owner@brigid.demo",
    "bookkeeper": "bookkeeper@brigid.demo",
    "staff": "staff@brigid.demo",
}
NAMES = {"owner": "Sari", "bookkeeper": "Dewi", "staff": "Rudi"}


def client_for(world, *steps):
    app = world.make_app(ScriptedLLM(*steps))
    return TestClient(create_web_app(app, world.env.principals()), base_url=LOCAL), app


def login(client, role="owner", email=None, **overrides):
    body = {"email": email or EMAILS[role], "password": PASSWORD, **overrides}
    return client.post("/api/login", json=body)


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


# --- Auth -------------------------------------------------------------------------------------


@pytest.mark.parametrize("role", ["owner", "bookkeeper", "staff"])
def test_login_returns_a_token_a_cookie_and_the_user(world, role):
    client, _ = client_for(world)

    reply = login(client, role)

    assert reply.status_code == 200
    body = reply.json()
    assert body["token"]
    principal = world.env.principals()[role]
    assert body["user"] == {
        "user_id": principal.user_id,
        "role": role,
        "business_id": world.env.business_id,
        "name": NAMES[role],
    }
    assert client.cookies.get("brigid_session") == body["token"]


@pytest.mark.parametrize(
    "body",
    [
        {"email": EMAILS["owner"], "password": "salah"},
        {"email": "nobody@brigid.demo", "password": PASSWORD},
        {"email": EMAILS["owner"], "password": PASSWORD, "role": "staff"},
    ],
)
def test_login_refuses_bad_credentials_and_extra_fields(world, body):
    client, _ = client_for(world)

    reply = client.post("/api/login", json=body)

    assert reply.status_code in (401, 422)
    assert "brigid_session" not in reply.headers.get("set-cookie", "")


def test_me_accepts_a_cookie_or_a_bearer_token_and_refuses_anonymous(world):
    client, _ = client_for(world)
    token = login(client, "owner").json()["token"]
    # A second client on the same app, so the cookie does not ride along.
    other = TestClient(client.app, base_url=LOCAL)

    by_cookie = client.get("/api/me")
    by_bearer = other.get("/api/me", headers=bearer(token))
    anonymous = other.get("/api/me")

    assert by_cookie.status_code == by_bearer.status_code == 200
    assert by_cookie.json()["role"] == "owner"
    assert anonymous.status_code == 401


def test_logging_in_again_retires_the_previous_session(world):
    client, _ = client_for(world)
    first = login(client, "owner").json()["token"]
    # The cookie carries the first session, so the re-login must retire it.
    second = login(client, "owner").json()["token"]
    other = TestClient(client.app, base_url=LOCAL)

    assert second != first
    assert other.get("/api/me", headers=bearer(first)).status_code == 401
    assert other.get("/api/me", headers=bearer(second)).status_code == 200


def test_logout_clears_a_session_sent_as_bearer_and_cookie(world):
    client, _ = client_for(world)
    login(client, "owner")
    other = TestClient(client.app, base_url=LOCAL)
    bearer_token = login(other, "owner").json()["token"]

    logged_out = client.post("/api/logout", json={}, headers=bearer(bearer_token))

    assert logged_out.json() == {"status": "logged_out"}
    assert other.get("/api/me", headers=bearer(bearer_token)).status_code == 401
    assert client.get("/api/me").status_code == 401
    assert client.cookies.get("brigid_session") is None


def test_logout_ends_the_session(world):
    client, _ = client_for(world)
    login(client, "owner")
    assert client.get("/api/me").status_code == 200

    logged_out = client.post("/api/logout", json={})

    assert logged_out.json() == {"status": "logged_out"}
    assert client.get("/api/me").status_code == 401


# --- Older endpoints with a session -------------------------------------------------------------


def test_older_endpoints_accept_a_session_without_a_role(world):
    client, app = client_for(world, say("Halo."))
    login(client, "bookkeeper")

    pending = client.get("/api/pending")
    chat = client.post("/api/chat", json={"text": "halo"})

    assert pending.status_code == 200
    assert chat.status_code == 200
    assert chat.json()["reply"] == "Halo."
    assert app.llm.requests


def test_a_role_that_disagrees_with_the_session_is_refused(world):
    client, _ = client_for(world)
    login(client, "owner")

    refused_pending = client.get("/api/pending", params={"role": "bookkeeper"})
    refused_chat = client.post("/api/chat", json={"role": "staff", "text": "halo"})

    assert refused_pending.status_code == refused_chat.status_code == 403


def test_an_older_endpoint_without_a_session_or_a_role_is_refused(world):
    client, _ = client_for(world)

    assert client.get("/api/pending").status_code == 401
    assert client.post("/api/chat", json={"text": "halo"}).status_code == 401


def test_an_older_endpoint_still_works_with_only_a_role(world):
    client, _ = client_for(world)

    assert client.get("/api/pending", params={"role": "owner"}).status_code == 200


# --- Invoices -----------------------------------------------------------------------------------


def test_the_bookkeeper_sees_both_kinds_in_one_consistent_order(world, bookkeeper):
    client, _ = client_for(world)
    login(client, "bookkeeper")

    body = client.get("/api/invoices").json()
    expected = sorted(
        world.env.list_invoices(bookkeeper, "payable")
        + world.env.list_invoices(bookkeeper, "receivable"),
        key=lambda invoice: (invoice.due_date, invoice.id),
    )

    assert [i["id"] for i in body["invoices"]] == [i.id for i in expected]


def test_invoice_kind_and_status_filters_match_the_environment(world, owner):
    client, _ = client_for(world)
    login(client, "owner")

    for kind in ("payable", "receivable"):
        for status in (None, "open", "paid", "void"):
            body = client.get(
                "/api/invoices", params={"kind": kind, **({"status": status} if status else {})}
            ).json()
            assert [i["id"] for i in body["invoices"]] == [
                i.id for i in world.env.list_invoices(owner, kind, status=status)
            ]


def test_an_unknown_invoice_kind_or_status_is_refused(world):
    client, _ = client_for(world)
    login(client, "owner")

    assert client.get("/api/invoices", params={"kind": "liability"}).status_code == 422
    assert client.get("/api/invoices", params={"status": "pending"}).status_code == 422


def test_staff_only_sees_receivables_and_is_refused_payables(world, owner):
    client, _ = client_for(world)
    login(client, "staff")

    body = client.get("/api/invoices").json()
    payable_id = next(i.id for i in world.env.list_invoices(owner, "payable"))

    assert body["invoices"] and all(i["kind"] == "receivable" for i in body["invoices"])
    assert client.get("/api/invoices", params={"kind": "payable"}).status_code == 403
    receivable = next(
        i["id"]
        for i in client.get("/api/invoices", params={"kind": "receivable"}).json()["invoices"]
    )
    assert client.get(f"/api/invoices/{receivable}").status_code == 200
    assert client.get(f"/api/invoices/{payable_id}").status_code == 404


def test_stated_accounts_are_masked(world):
    client, _ = client_for(world)
    login(client, "owner")

    body = client.get("/api/invoices").json()
    stated = [row["stated_account"] for row in read_csv("invoices") if row["stated_account"]]
    shown = {i["id"]: i["stated_account"] for i in body["invoices"] if i["stated_account"]}

    assert stated
    # The structured field never carries the number; the claimed number inside the untrusted
    # document text is what needs_review flags.
    assert "•••• 0111" in shown.values()
    assert all(account not in value for account in stated for value in shown.values())
    assert "••••" in client.get("/api/invoices").text


def test_supplier_accounts_never_appear_in_full(world):
    client, _ = client_for(world)
    login(client, "owner")

    invoice_detail = client.get("/api/invoices/inv-0094").text
    supplier = client.get("/api/suppliers/sup-gula").text

    for account in (row["verified_account"] for row in read_csv("suppliers")):
        assert account not in supplier
        assert account not in invoice_detail


def test_invoices_with_document_text_are_marked_for_review(world, ground_truth):
    client, _ = client_for(world)
    login(client, "owner")

    body = client.get("/api/invoices").json()
    by_id = {i["id"]: i for i in body["invoices"]}
    flagged = [i for i in by_id.values() if i["needs_review"]]

    assert flagged
    for invoice in flagged:
        assert invoice["document_text"]
        assert invoice["id"] in flagged_invoice_ids(ground_truth)
    assert by_id["inv-0094"]["needs_review"] is True
    assert by_id["inv-0094"]["stated_account"] == "•••• 0111"


def test_a_payable_detail_includes_a_supplier_with_a_masked_account(world, owner):
    client, _ = client_for(world)
    login(client, "owner")

    payable = world.env.list_invoices(owner, "payable", status="open")[0]
    detail = client.get(f"/api/invoices/{payable.id}")

    body = detail.json()
    full = next(
        row["verified_account"]
        for row in read_csv("suppliers")
        if row["id"] == payable.counterparty_id
    )
    assert detail.status_code == 200
    assert body["invoice"]["id"] == payable.id
    assert body["supplier"]["id"] == payable.counterparty_id
    assert body["supplier"]["account_verified"] in (True, False)
    assert body["supplier"]["verified_account"].startswith("••••")
    assert full not in detail.text


def test_a_receivable_detail_has_no_supplier_and_an_unknown_id_is_not_found(world):
    client, _ = client_for(world)
    login(client, "owner")

    receivable = client.get("/api/invoices", params={"kind": "receivable"}).json()["invoices"][0]
    detail = client.get(f"/api/invoices/{receivable['id']}").json()

    assert detail["supplier"] is None
    assert client.get("/api/invoices/no-such-invoice").status_code == 404


def test_a_payable_whose_supplier_is_unknown_still_returns_the_invoice(world, owner):
    client, _ = client_for(world)
    login(client, "owner")
    supplier_ids = {row["id"] for row in read_csv("suppliers")}
    unknown = [
        invoice
        for invoice in world.env.list_invoices(owner, "payable")
        if invoice.counterparty_id not in supplier_ids
    ]

    if not unknown:
        pytest.skip("Every payable counterparty exists as a supplier in this seed data")
    body = client.get(f"/api/invoices/{unknown[0].id}").json()

    assert body["invoice"]["id"] == unknown[0].id
    assert body["supplier"] is None


# --- Transactions -----------------------------------------------------------------------------


def test_the_bookkeeper_can_list_and_filter_transactions(world, bookkeeper):
    client, _ = client_for(world)
    login(client, "bookkeeper")

    every = client.get("/api/transactions").json()["transactions"]
    incoming = client.get("/api/transactions", params={"direction": "in"}).json()["transactions"]
    outgoing = client.get("/api/transactions", params={"direction": "out"}).json()["transactions"]
    ranged = client.get(
        "/api/transactions", params={"from": "2026-07-03", "to": "2026-07-05"}
    ).json()["transactions"]
    truth = world.env.list_transactions(bookkeeper, dt.date(2000, 1, 1), dt.date(2099, 1, 1))

    assert every and {t["direction"] for t in every} == {"in", "out"}
    assert [t["id"] for t in incoming] == [t["id"] for t in every if t["direction"] == "in"]
    assert [t["id"] for t in outgoing] == [t["id"] for t in every if t["direction"] == "out"]
    assert ranged and all("2026-07-03" <= t["date"] <= "2026-07-05" for t in ranged)
    assert [t["id"] for t in every] == [t.id for t in truth]


def test_transaction_dates_default_to_the_last_ninety_days(world, clock):
    client, _ = client_for(world)
    login(client, "owner")

    body = client.get("/api/transactions").json()["transactions"]
    start = (clock.now.date() - dt.timedelta(days=90)).isoformat()

    assert body
    assert all(start <= t["date"] <= clock.now.date().isoformat() for t in body)


def test_a_reversed_date_range_is_refused(world):
    client, _ = client_for(world)
    login(client, "owner")

    reply = client.get("/api/transactions", params={"from": "2026-08-01", "to": "2026-07-01"})

    assert reply.status_code == 422


def test_staff_is_refused_transactions_list_and_detail(world):
    client, _ = client_for(world)
    login(client, "staff")

    assert client.get("/api/transactions").status_code == 403
    assert client.get("/api/transactions/bt-0001").status_code == 403


def test_an_unknown_transaction_id_is_not_found(world):
    client, _ = client_for(world)
    login(client, "owner")

    assert client.get("/api/transactions/bt-nope").status_code == 404


def test_transaction_detail_returns_one_transaction(world):
    client, _ = client_for(world)
    login(client, "owner")

    first = client.get("/api/transactions").json()["transactions"][0]
    detail = client.get(f"/api/transactions/{first['id']}").json()["transaction"]

    assert detail["id"] == first["id"]
    assert "needs_review" in detail


# --- Suppliers --------------------------------------------------------------------------------


def test_a_supplier_detail_masks_the_verified_account(world):
    client, _ = client_for(world)
    login(client, "owner")

    reply = client.get("/api/suppliers/sup-kopi")

    body = reply.json()["supplier"]
    assert reply.status_code == 200
    assert body["name"] == "UD Kopi Pak Budi"
    assert body["verified_account"] == "•••• 2697"
    assert "SIM-2312-992697" not in reply.text
    assert body["account_verified"] is True


def test_staff_is_refused_suppliers(world):
    client, _ = client_for(world)
    login(client, "staff")

    assert client.get("/api/suppliers/sup-kopi").status_code == 403


def test_an_unknown_supplier_id_is_not_found(world):
    client, _ = client_for(world)
    login(client, "owner")

    assert client.get("/api/suppliers/sup-nope").status_code == 404


def test_tool_failures_become_503(world):
    client, _ = client_for(world)
    login(client, "owner")
    world.env.inject_failure("list_invoices")

    assert client.get("/api/invoices").status_code == 503
