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
from brigid.interfaces.common import SIMULATION_NOTE, draft_demo_mandate, request_view
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


def create_web_app(
    app: BrigidApp, principals: Mapping[str, Principal], hosts: Sequence[str] = LOCAL_HOSTS
) -> FastAPI:
    """The FastAPI application. ``principals`` maps each role the page offers to the user it
    acts as. ``hosts`` are the host names this server answers to; any other ``Host`` header is
    refused, which stops a website whose name was pointed at this computer from reaching it."""
    api = FastAPI(title="Brigid (simulation)", docs_url=None, redoc_url=None, openapi_url=None)
    # A Host header carries an IPv6 address in brackets ("[::1]:8000"), and the middleware
    # compares it with the brackets kept.
    allowed = [f"[{host}]" if ":" in host else host for host in hosts]
    api.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed)

    # Server-side sessions: token -> principal. Small, in memory, and gone on restart.
    sessions: dict[str, Principal] = {}
    session_lock = threading.Lock()

    def principal(role: str) -> Principal:
        found = principals.get(role)
        if found is None:
            raise HTTPException(404, f"No {role} in this business.")
        return found

    def session_of(request: Request) -> tuple[str, Principal] | None:
        """The session for a request, from the Bearer header or the session cookie."""
        auth = request.headers.get("authorization", "")
        token = auth[7:].strip() if auth[:7].lower() == "bearer " else None
        token = token or request.cookies.get(SESSION_COOKIE)
        if token is None:
            return None
        with session_lock:
            found = sessions.get(token)
        return (token, found) if found is not None else None

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

    def needs_review(text: str | None, p: Principal, origin: str) -> bool:
        """Screen one untrusted free-text field; only the verdict leaves the guard."""
        if not text or not text.strip():
            return False
        verdict = app.guard.screen_untrusted(
            text,
            principal=p,
            session_id=f"web-api:{p.user_id}",
            source="data",
            origin=origin,
        )
        return verdict.suspicious

    def user_view(p: Principal) -> dict:
        account = next((a for a in DEMO_ACCOUNTS if a.role == p.role), None)
        return {
            "user_id": p.user_id,
            "role": p.role,
            "business_id": p.business_id,
            "name": account.name if account else p.user_id,
        }

    def invoice_view(invoice: Invoice, p: Principal) -> dict:
        data = invoice.model_dump(mode="json")
        data["stated_account"] = mask_account(invoice.stated_account)
        data["needs_review"] = needs_review(
            invoice.document_text, p, origin=f"invoice:{invoice.id}:document_text"
        )
        return data

    def transaction_view(transaction: BankTransaction, p: Principal) -> dict:
        data = transaction.model_dump(mode="json")
        data["needs_review"] = needs_review(
            transaction.memo, p, origin=f"transaction:{transaction.id}:memo"
        )
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
                return JSONResponse({"detail": "Refused."}, status_code=403)
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
    def login(body: LoginBody, response: Response) -> dict:
        email = body.email.strip().lower()
        account = next((a for a in DEMO_ACCOUNTS if a.email == email), None)
        if account is None or not hmac.compare_digest(
            account.password.encode(), body.password.encode()
        ):
            raise HTTPException(401, "Invalid email or password.")
        found = principals.get(account.role)
        if found is None:
            raise HTTPException(401, "Invalid email or password.")
        token = secrets.token_urlsafe(32)
        with session_lock:
            sessions[token] = found
        response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", path="/")
        return {"token": token, "user": user_view(found)}

    @api.post("/api/logout")
    def logout(request: Request, response: Response) -> dict:
        # The CSRF middleware still applies: callers must send a JSON content type.
        found = session_of(request)
        if found is not None:
            with session_lock:
                sessions.pop(found[0], None)
        response.delete_cookie(SESSION_COOKIE, path="/")
        return {"status": "logged_out"}

    @api.get("/api/me")
    def me(request: Request) -> dict:
        return user_view(signed_in(request))

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
        return {"invoices": [invoice_view(invoice, p) for invoice in items]}

    @api.get("/api/invoices/{invoice_id}")
    def invoice_detail(invoice_id: str, request: Request) -> dict:
        p = signed_in(request)
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
        return {"invoice": invoice_view(match, p), "supplier": supplier}

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
        return {"transactions": [transaction_view(t, p) for t in items]}

    @api.get("/api/transactions/{transaction_id}")
    def transaction_detail(transaction_id: str, request: Request) -> dict:
        p = signed_in(request)
        end = app.today() + dt.timedelta(days=365)
        items = read_env(lambda: app.env.list_transactions(p, dt.date(2000, 1, 1), end))
        found = next((t for t in items if t.id == transaction_id), None)
        if found is None:
            raise HTTPException(404, "No transaction with that id.")
        return {"transaction": transaction_view(found, p)}

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
    uvicorn.run(create_web_app(app, app.env.principals(), hosts), host=args.host, port=args.port)
    return 0
