"""User account storage and password/OAuth helpers for the Brigid web interface."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
import threading
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Role = Literal["owner", "bookkeeper", "staff"]
OAuthProvider = Literal["google", "github"]

_SCRYPT_N = 16384
_SCRYPT_R = 8
_SCRYPT_P = 1
_SCRYPT_DKLEN = 32


class AccountConflictError(Exception):
    """Raised when creating an account with an email that is already registered."""


@dataclass(frozen=True)
class AccountRecord:
    """One registered web user account."""

    id: str
    email: str
    name: str
    role: Role
    password_hash: str | None = None
    provider: OAuthProvider | None = None
    provider_user_id: str | None = None


def hash_password(password: str) -> str:
    """Hash a password with scrypt and a random 16-byte salt."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_SCRYPT_DKLEN,
    )
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a plaintext password against a stored ``salt$digest`` scrypt hash."""
    try:
        salt_hex, digest_hex = stored_hash.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except ValueError:
        return False
    actual = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=len(expected),
    )
    return hmac.compare_digest(actual, expected)


class AccountStore:
    """Thread-safe store for email/password and OAuth user accounts."""

    def __init__(self, db_path: Path | None = None) -> None:
        self._lock = threading.Lock()
        self._conn: sqlite3.Connection | None = None
        self._accounts: dict[str, AccountRecord] = {}
        if db_path is not None:
            db_path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS web_accounts (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    password_hash TEXT,
                    provider TEXT,
                    provider_user_id TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            self._conn.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_web_accounts_oauth
                ON web_accounts (provider, provider_user_id)
                WHERE provider IS NOT NULL AND provider_user_id IS NOT NULL
                """
            )
            self._conn.commit()
            self._load_from_db()

    def _load_from_db(self) -> None:
        assert self._conn is not None
        rows = self._conn.execute(
            "SELECT id, email, name, role, password_hash, provider, provider_user_id "
            "FROM web_accounts"
        ).fetchall()
        for row in rows:
            record = AccountRecord(
                id=row["id"],
                email=row["email"],
                name=row["name"],
                role=row["role"],
                password_hash=row["password_hash"],
                provider=row["provider"],
                provider_user_id=row["provider_user_id"],
            )
            self._accounts[record.id] = record

    def _persist(self, record: AccountRecord) -> None:
        if self._conn is None:
            return
        self._conn.execute(
            """
            INSERT INTO web_accounts (
                id, email, name, role, password_hash, provider, provider_user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                email = excluded.email,
                name = excluded.name,
                role = excluded.role,
                password_hash = excluded.password_hash,
                provider = excluded.provider,
                provider_user_id = excluded.provider_user_id
            """,
            (
                record.id,
                record.email,
                record.name,
                record.role,
                record.password_hash,
                record.provider,
                record.provider_user_id,
            ),
        )
        self._conn.commit()

    def _find_by_email_unlocked(self, email: str) -> AccountRecord | None:
        return next((acc for acc in self._accounts.values() if acc.email == email), None)

    def _find_by_oauth_unlocked(
        self, provider: OAuthProvider, provider_user_id: str
    ) -> AccountRecord | None:
        return next(
            (
                acc
                for acc in self._accounts.values()
                if acc.provider == provider and acc.provider_user_id == provider_user_id
            ),
            None,
        )

    def create_email_account(
        self,
        *,
        name: str,
        email: str,
        password: str,
        role: Role = "owner",
        reserved_emails: Iterable[str] = (),
    ) -> AccountRecord:
        normalized_email = email.strip().lower()
        clean_name = name.strip()
        reserved = {item.strip().lower() for item in reserved_emails}
        with self._lock:
            if normalized_email in reserved or self._find_by_email_unlocked(normalized_email):
                raise AccountConflictError("An account with this email already exists.")
            record = AccountRecord(
                id=f"acct_{secrets.token_urlsafe(12)}",
                email=normalized_email,
                name=clean_name,
                role=role,
                password_hash=hash_password(password),
            )
            self._accounts[record.id] = record
            self._persist(record)
            return record

    def authenticate_email(self, email: str, password: str) -> AccountRecord | None:
        normalized_email = email.strip().lower()
        with self._lock:
            account = self._find_by_email_unlocked(normalized_email)
        if account is None or account.password_hash is None:
            return None
        if not verify_password(password, account.password_hash):
            return None
        return account

    def signup_oauth_account(
        self,
        *,
        provider: OAuthProvider,
        provider_user_id: str,
        email: str,
        name: str,
        role: Role = "owner",
        reserved_emails: Iterable[str] = (),
    ) -> AccountRecord:
        normalized_email = email.strip().lower()
        clean_name = name.strip() or normalized_email.split("@")[0]
        reserved = {item.strip().lower() for item in reserved_emails}
        with self._lock:
            existing_oauth = self._find_by_oauth_unlocked(provider, provider_user_id)
            if existing_oauth is not None:
                updated = AccountRecord(
                    id=existing_oauth.id,
                    email=normalized_email,
                    name=clean_name,
                    role=existing_oauth.role,
                    password_hash=existing_oauth.password_hash,
                    provider=provider,
                    provider_user_id=provider_user_id,
                )
                self._accounts[updated.id] = updated
                self._persist(updated)
                return updated

            if normalized_email in reserved or self._find_by_email_unlocked(normalized_email):
                raise AccountConflictError(
                    "An account with this email already exists. "
                    "Please sign in with your existing method."
                )

            record = AccountRecord(
                id=f"acct_{secrets.token_urlsafe(12)}",
                email=normalized_email,
                name=clean_name,
                role=role,
                provider=provider,
                provider_user_id=provider_user_id,
            )
            self._accounts[record.id] = record
            self._persist(record)
            return record

    def authenticate_oauth(
        self, provider: OAuthProvider, provider_user_id: str
    ) -> AccountRecord | None:
        with self._lock:
            return self._find_by_oauth_unlocked(provider, provider_user_id)
