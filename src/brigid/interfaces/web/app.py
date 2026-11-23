"""A minimal web front end for the demo. SIMULATION ONLY.

    uv run python -m brigid.interfaces.web

One static chat page and a small JSON API. The demo accounts in ``DEMO_ACCOUNTS`` sign in to a
server-side session (``POST /api/login``); the new read endpoints under ``/api/invoices``,
``/api/transactions`` and ``/api/suppliers`` require one. The older endpoints still accept the
role picked in the page, as a stand-in for logging in, so the current page keeps working until
Phase 5 moves it to sessions.

Confirmation tokens never leave the server: the page names a request by its id, and the guard
checks the role again when it is confirmed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hmac
import os
import re
import secrets
import sys
import threading
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field

from brigid.app import BrigidApp, SetupError, build_app
from brigid.config import ConfigError, load_settings
from brigid.guard.sentinel import heuristic_verdict
from brigid.interfaces.common import SIMULATION_NOTE, draft_demo_mandate, request_view
from brigid.interfaces.web.auth import AccountConflictError, AccountStore, OAuthProvider
from brigid.models import BankTransaction, Direction, Invoice, Principal
from brigid.tools.base import AccessDenied, NotFound, ToolFailure

CHANNEL = "web"
STATIC = Path(__file__).with_name("static")
MAX_MESSAGE_CHARS = 4000
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")
SESSION_COOKIE = "brigid_session"
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; "
        "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}

Role = Literal["owner", "bookkeeper", "staff"]
InvoiceKind = Literal["payable", "receivable"]
InvoiceStatus = Literal["open", "paid", "void"]


class DemoAccount(BaseModel):
    """One demo login, standing in for a real account. The names match
    ``data/seed/users.csv``; the principal itself always comes from ``principals``."""

    email: str
    password: str
    role: Role
    name: str


DEMO_ACCOUNTS = (
    DemoAccount(email="owner@brigid.demo", password="brigid123", role="owner", name="Sari"),
    DemoAccount(
        email="bookkeeper@brigid.demo", password="brigid123", role="bookkeeper", name="Dewi"
    ),
    DemoAccount(email="staff@brigid.demo", password="brigid123", role="staff", name="Rudi"),
)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Role | None = None


class ChatBody(_Body):
    text: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


class RequestBody(_Body):
    subject_id: str = Field(min_length=1, max_length=100)


class LoginBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str
    password: str


class SignupBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    role: Role = "owner"


class OAuthCompleteBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: OAuthProvider
    provider_user_id: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=254)
    name: str = Field(min_length=1, max_length=100)
    intent: Literal["signup", "login"]
    role: Role = "owner"


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_web_app(
    app: BrigidApp,
    principals: Mapping[str, Principal],
    hosts: Sequence[str] = LOCAL_HOSTS,
    account_store: AccountStore | None = None,
) -> FastAPI:
    """The FastAPI application. ``principals`` maps each role the page offers to the user it
    acts as. ``hosts`` are the host names this server answers to; any other ``Host`` header is
    refused, which stops a website whose name was pointed at this computer from reaching it."""
    api = FastAPI(title="Brigid (simulation)", docs_url=None, redoc_url=None, openapi_url=None)
    # A Host header carries an IPv6 address in brackets ("[::1]:8000"), and the middleware
    # compares it with the brackets kept.
    allowed = [f"[{host}]" if ":" in host else host for host in hosts]
    api.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed)

    accounts = account_store or AccountStore()
    demo_emails = [account.email for account in DEMO_ACCOUNTS]

    # Server-side sessions: token -> (principal, display_name).
    sessions: dict[str, tuple[Principal, str | None]] = {}
    session_lock = threading.Lock()

    def principal(role: str) -> Principal:
        found = principals.get(role)
        if found is None:
            raise HTTPException(404, f"No {role} in this business.")
        return found

    def presented_tokens(request: Request) -> list[str]:
        """Every session token the request presents: the Bearer header first, then the cookie."""
        auth = request.headers.get("authorization", "")
        tokens = [auth[7:].strip()] if auth[:7].lower() == "bearer " else []
        cookie = request.cookies.get(SESSION_COOKIE)
        if cookie:
            tokens.append(cookie)
        return [token for token in tokens if token]

    def session_of(request: Request) -> tuple[str, Principal, str | None] | None:
        """The session for a request, from the Bearer header or the session cookie."""
        for token in presented_tokens(request):
            with session_lock:
                found = sessions.get(token)
            if found is not None:
                return token, found[0], found[1]
        return None

    def signed_in(request: Request) -> Principal:
        found = session_of(request)
        if found is None:
            raise HTTPException(401, "Please sign in.")
        return found[1]

    def actor(request: Request, role: str | None) -> Principal:
        """The principal for the older endpoints: the session when one is present, otherwise
        the named role. A role that disagrees with the session is refused."""
        found = session_of(request)
        if found is not None:
            if role is not None and role != found[1].role:
                raise HTTPException(403, "That role does not match your session.")
            return found[1]
        if role is not None:
            return principal(role)
        raise HTTPException(401, "Please sign in, or pass a role.")

    def read_env(call):
        try:
            return call()
        except AccessDenied as error:
            raise HTTPException(403, str(error)) from None
        except NotFound as error:
            raise HTTPException(404, str(error)) from None
        except ToolFailure as error:  # ToolTimeout is a ToolFailure.
            raise HTTPException(503, str(error)) from None

    def mask_account(account: str | None) -> str | None:
        """Only the last four significant characters of an account number may leave the server."""
        if account is None:
            return None
        significant = "".join(ch for ch in account if ch.isalnum())
        tail = significant[-4:] if len(significant) >= 4 else ""
        return f"•••• {tail}" if tail else "••••"

    def needs_review(text: str | None) -> bool:
        """Screen one untrusted free-text field via cached heuristics; only the verdict leaves."""
        if not text or not text.strip():
            return False
        return heuristic_verdict(text, "data").suspicious

    def user_view(p: Principal, display_name: str | None = None) -> dict:
        account = next((a for a in DEMO_ACCOUNTS if a.role == p.role), None)
        return {
            "user_id": p.user_id,
            "role": p.role,
            "business_id": p.business_id,
            "name": display_name or (account.name if account else p.user_id),
        }

    def issue_session(
        request: Request, response: Response, found: Principal, display_name: str | None = None
    ) -> dict:
        # A fresh sign-in retires the session the request presented, so a re-login leaves
        # no stale token behind.
        with session_lock:
            for token in presented_tokens(request):
                sessions.pop(token, None)
            token = secrets.token_urlsafe(32)
            sessions[token] = (found, display_name)
        response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", path="/")
        return {"token": token, "user": user_view(found, display_name)}

    def invoice_view(invoice: Invoice) -> dict:
        data = invoice.model_dump(mode="json")
        data["stated_account"] = mask_account(invoice.stated_account)
        data["needs_review"] = needs_review(invoice.document_text)
        return data

    def transaction_view(transaction: BankTransaction) -> dict:
        data = transaction.model_dump(mode="json")
        data["needs_review"] = needs_review(transaction.memo)
        return data

    @api.middleware("http")
    async def guard_requests(request: Request, call_next):
        # Another website open in the same browser may not drive this one: a changing request
        # must be JSON (which a plain cross-site form cannot send) from a page on a local host.
        # The Origin is checked against the configured hosts, not against the Host header,
        # which the caller chooses.
        if request.method not in ("GET", "HEAD"):
            # Media types are case-insensitive (RFC 9110), so compare lowercased.
            content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
            origin = request.headers.get("origin")
            local_origin = origin is None or urlsplit(origin).hostname in hosts
            if content_type != "application/json" or not local_origin:
                # An early return skips the header update below, so carry them here.
                return JSONResponse(
                    {"detail": "Refused."}, status_code=403, headers=SECURITY_HEADERS
                )
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        return response

    @api.get("/", include_in_schema=False)
    def index() -> FileResponse:
        return FileResponse(STATIC / "index.html")

    @api.get("/api/info")
    def info() -> dict:
        return {
            "simulation": SIMULATION_NOTE,
            "roles": [role for role in ("owner", "bookkeeper", "staff") if role in principals],
            "screening_model": app.sentinel_model_enabled,
        }

    @api.post("/api/login")
    def login(body: LoginBody, request: Request, response: Response) -> dict:
        email = body.email.strip().lower()
        demo = next((a for a in DEMO_ACCOUNTS if a.email == email), None)
        if demo is not None:
            if not hmac.compare_digest(demo.password.encode(), body.password.encode()):
                raise HTTPException(401, "Invalid email or password.")
            found = principals.get(demo.role)
            if found is None:
                raise HTTPException(401, "Invalid email or password.")
            return issue_session(request, response, found, demo.name)

        registered = accounts.authenticate_email(email, body.password)
        if registered is None:
            raise HTTPException(401, "Invalid email or password.")
        found = principals.get(registered.role)
        if found is None:
            raise HTTPException(401, "Invalid email or password.")
        return issue_session(request, response, found, registered.name)

    @api.post("/api/signup")
    def signup(body: SignupBody, request: Request, response: Response) -> dict:
        email = body.email.strip().lower()
        name = body.name.strip()
        if not name:
            raise HTTPException(422, "Name is required.")
        if not _EMAIL_RE.match(email):
            raise HTTPException(422, "Enter a valid email address.")
        found = principals.get(body.role)
        if found is None:
            raise HTTPException(422, f"Role '{body.role}' is not available in this business.")
        try:
            created = accounts.create_email_account(
                name=name,
                email=email,
                password=body.password,
                role=found.role,
                reserved_emails=demo_emails,
            )
        except AccountConflictError as error:
            raise HTTPException(409, str(error)) from None
        return issue_session(request, response, found, created.name)

    @api.post("/api/oauth/complete")
    def oauth_complete(body: OAuthCompleteBody, request: Request, response: Response) -> dict:
        internal_secret = os.environ.get("BRIGID_INTERNAL_AUTH_SECRET", "")
        if internal_secret:
            presented = request.headers.get("x-brigid-internal-secret", "")
            if not hmac.compare_digest(presented.encode(), internal_secret.encode()):
                raise HTTPException(403, "Refused.")

        email = body.email.strip().lower()
        if not _EMAIL_RE.match(email):
            raise HTTPException(422, "A valid email address is required from the OAuth provider.")

        if body.intent == "signup":
            found = principals.get(body.role)
            if found is None:
                raise HTTPException(
                    422, f"Role '{body.role}' is not available in this business."
                )
            try:
                account = accounts.signup_oauth_account(
                    provider=body.provider,
                    provider_user_id=body.provider_user_id,
                    email=email,
                    name=body.name,
                    role=found.role,
                    reserved_emails=demo_emails,
                )
            except AccountConflictError as error:
                raise HTTPException(409, str(error)) from None
            return issue_session(request, response, found, account.name)

        account = accounts.authenticate_oauth(body.provider, body.provider_user_id)
        if account is None:
            provider_label = "Google" if body.provider == "google" else "GitHub"
            raise HTTPException(
                401,
                f"No account found for this {provider_label} account. Please sign up first.",
            )
        found = principals.get(account.role)
        if found is None:
            raise HTTPException(401, "Account role is not available in this business.")
        return issue_session(request, response, found, account.name)

    @api.post("/api/logout")
    def logout(request: Request, response: Response) -> dict:
        # The CSRF middleware still applies: callers must send a JSON content type. The
        # request may carry a session twice, as a Bearer token and as the cookie.
        with session_lock:
            for token in presented_tokens(request):
                sessions.pop(token, None)
        response.delete_cookie(SESSION_COOKIE, path="/")
        return {"status": "logged_out"}

    @api.get("/api/me")
    def me(request: Request) -> dict:
        found = session_of(request)
        if found is None:
            raise HTTPException(401, "Please sign in.")
        return user_view(found[1], found[2])

    @api.get("/api/invoices")
    def invoices(
        request: Request, kind: InvoiceKind | None = None, status: InvoiceStatus | None = None
    ) -> dict:
        p = signed_in(request)
        if kind is not None:
            items = read_env(lambda: app.env.list_invoices(p, kind, status=status))
        elif p.role == "staff":
            items = read_env(lambda: app.env.list_invoices(p, "receivable", status=status))
        else:
            # One consistent order across the two kinds.
            items = sorted(
                read_env(lambda: app.env.list_invoices(p, "payable", status=status))
                + read_env(lambda: app.env.list_invoices(p, "receivable", status=status)),
                key=lambda invoice: (invoice.due_date, invoice.id),
            )
        return {"invoices": [invoice_view(invoice) for invoice in items]}

    @api.get("/api/invoices/{invoice_id}")
    def invoice_detail(invoice_id: str, request: Request) -> dict:
        p = signed_in(request)
        if hasattr(app.env, "get_invoice"):
            match = read_env(lambda: app.env.get_invoice(p, invoice_id))
        else:
            # Staff may only ever see receivables, so a payable id is simply not found for them.
            kinds = ("receivable",) if p.role == "staff" else ("payable", "receivable")
            match = None
            for kind in kinds:
                found = read_env(lambda kind=kind: app.env.list_invoices(p, kind))
                match = next((invoice for invoice in found if invoice.id == invoice_id), None)
                if match is not None:
                    break
            if match is None:
                raise HTTPException(404, "No invoice with that id.")
        supplier = None
        if p.role != "staff" and match.kind == "payable":
            try:
                found = app.env.get_supplier(p, match.counterparty_id)
            except NotFound:
                found = None
            except ToolFailure as error:
                raise HTTPException(503, str(error)) from None
            supplier = (
                None
                if found is None
                else {
                    "id": found.id,
                    "name": found.name,
                    "account_verified": found.account_verified,
                    "verified_account": mask_account(found.verified_account),
                }
            )
        return {"invoice": invoice_view(match), "supplier": supplier}

    @api.get("/api/transactions")
    def transactions(
        request: Request,
        direction: Direction | None = None,
        start_date: Annotated[dt.date | None, Query(alias="from")] = None,
        end_date: Annotated[dt.date | None, Query(alias="to")] = None,
    ) -> dict:
        p = signed_in(request)
        end = end_date or app.today()
        start = start_date or end - dt.timedelta(days=90)
        if start > end:
            raise HTTPException(422, "The start date must not be after the end date.")
        items = read_env(lambda: app.env.list_transactions(p, start, end))
        if direction is not None:
            items = [t for t in items if t.direction == direction]
        return {"transactions": [transaction_view(t) for t in items]}

    @api.get("/api/transactions/{transaction_id}")
    def transaction_detail(transaction_id: str, request: Request) -> dict:
        p = signed_in(request)
        if hasattr(app.env, "get_transaction"):
            found = read_env(lambda: app.env.get_transaction(p, transaction_id))
        else:
            end = app.today() + dt.timedelta(days=365)
            items = read_env(lambda: app.env.list_transactions(p, dt.date(2000, 1, 1), end))
            found = next((t for t in items if t.id == transaction_id), None)
            if found is None:
                raise HTTPException(404, "No transaction with that id.")
        return {"transaction": transaction_view(found)}

    @api.get("/api/suppliers/{supplier_id}")
    def supplier_detail(supplier_id: str, request: Request) -> dict:
        p = signed_in(request)
        found = read_env(lambda: app.env.get_supplier(p, supplier_id))
        data = found.model_dump(mode="json")
        data["verified_account"] = mask_account(found.verified_account)
        return {"supplier": data}

    @api.post("/api/chat")
    def chat(body: ChatBody, request: Request) -> dict:
        result = app.chat(actor(request, body.role), body.text, channel=CHANNEL)
        return {
            "reply": result.reply.text,
            "blocked": result.reply.blocked,
            "new_requests": [request_view(r) for r in result.new_confirmations],
        }

    @api.get("/api/pending")
    def pending(request: Request, role: Role | None = None) -> dict:
        return {"requests": [request_view(r) for r in app.pending(actor(request, role))]}

    @api.post("/api/confirm")
    def confirm(body: RequestBody, request: Request) -> dict:
        decision = app.confirm(
            actor(request, body.role), channel=CHANNEL, subject_id=body.subject_id
        )
        if decision is None:
            raise HTTPException(404, "Nothing with that id is waiting for you.")
        return {"status": decision.status, "message": decision.user_message}

    @api.post("/api/cancel")
    def cancel(body: RequestBody, request: Request) -> dict:
        if not app.cancel(actor(request, body.role), channel=CHANNEL, subject_id=body.subject_id):
            raise HTTPException(404, "Nothing with that id is waiting for you.")
        return {"status": "declined", "message": "Declined. Nothing was paid or changed."}

    @api.post("/api/mandate")
    def mandate(body: _Body, request: Request) -> dict:
        p = actor(request, body.role)
        if p.role != "owner":
            raise HTTPException(403, "Only the owner can set the mandate.")
        try:
            decision = draft_demo_mandate(app, p)
        except (PermissionError, ToolFailure):
            raise HTTPException(
                503, "The mandate could not be drafted. Please try again."
            ) from None
        return {"status": decision.status, "message": decision.user_message}

    @api.post("/api/reset")
    def reset(body: _Body, request: Request) -> dict:
        app.reset(actor(request, body.role), channel=CHANNEL)
        return {"status": "reset"}

    api.mount("/static", StaticFiles(directory=STATIC), name="static")
    return api


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Brigid demo web page (simulation only).")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    try:
        app = build_app(load_settings())
    except (SetupError, ConfigError) as error:
        print(f"Cannot start: {error}", file=sys.stderr)
        return 1
    if args.host not in LOCAL_HOSTS:
        print(
            f"WARNING: listening on {args.host}. The login uses shared demo credentials: "
            "anyone who can reach it can act as any role.",
            file=sys.stderr,
        )
    import uvicorn

    print(f"{SIMULATION_NOTE} Open http://{args.host}:{args.port}/")
    hosts = (*LOCAL_HOSTS, args.host)
    auth_db_path = Path(os.environ.get("BRIGID_AUTH_DB_PATH", "data/auth.db"))
    account_store = AccountStore(auth_db_path)
    uvicorn.run(
        create_web_app(app, app.env.principals(), hosts, account_store=account_store),
        host=args.host,
        port=args.port,
    )
    return 0
