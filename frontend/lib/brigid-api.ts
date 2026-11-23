export type Role = "owner" | "bookkeeper" | "staff";

export type BrigidInfo = {
  simulation: string;
  roles: Role[];
  screening_model: boolean;
};

export type UserSession = {
  user_id: string;
  role: Role;
  business_id: string;
  name: string;
};

export type LoginResult = {
  token: string;
  user: UserSession;
};

export type InvoiceKind = "payable" | "receivable";
export type InvoiceStatus = "open" | "paid" | "void";

export type Invoice = {
  id: string;
  kind: InvoiceKind;
  counterparty_id: string;
  counterparty_name: string;
  number: string;
  amount: string | number;
  currency: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  late_fee_bearing: boolean;
  stated_account: string | null;
  document_text: string | null;
  needs_review: boolean;
};

export type SupplierSummary = {
  id: string;
  name: string;
  account_verified: boolean;
  verified_account: string | null;
};

export type InvoiceDetailResult = {
  invoice: Invoice;
  supplier: SupplierSummary | null;
};

export type TransactionDirection = "in" | "out";

export type BankTransaction = {
  id: string;
  date: string;
  amount: string | number;
  direction: TransactionDirection;
  counterparty: string;
  memo: string;
  reference: string;
  needs_review: boolean;
};

export type TransactionDetailResult = {
  transaction: BankTransaction;
};

export type RiskWarning = { message: string };

export type PaymentSummary = {
  supplier_name: string;
  invoice_number: string;
  due_date: string;
  amount: string | number;
  currency: string;
  registered_account: string;
  balance_after: string | number;
};

export type PendingRequest = {
  kind: string;
  subject_id: string;
  required_role: Role;
  requested_by: string;
  expires_at: string;
  summary: PaymentSummary | null;
  changes: string[];
  risk_warnings: RiskWarning[];
};

export type ChatResult = {
  reply: string;
  blocked: boolean;
  new_requests: PendingRequest[];
};

export type DecisionResult = { status: string; message: string };

const REQUEST_TIMEOUT_MS = 33_000;

export async function brigidGet<T>(
  action: "info" | "pending",
  role?: Role,
): Promise<T> {
  const params = role ? `?role=${encodeURIComponent(role)}` : "";
  return brigidRequest<T>(`/api/brigid/${action}${params}`);
}

export async function brigidPost<T>(
  action: "chat" | "confirm" | "cancel" | "mandate" | "reset",
  body: Record<string, string>,
): Promise<T> {
  return brigidRequest<T>(`/api/brigid/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function brigidLogin(
  email: string,
  password: string,
): Promise<LoginResult> {
  return brigidRequest<LoginResult>("/api/brigid/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function brigidDemo(): Promise<LoginResult> {
  return brigidRequest<LoginResult>("/api/brigid/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

const SESSION_FLAG_KEY = "brigid_has_session";

export function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.sessionStorage.getItem(SESSION_FLAG_KEY) === "1" ||
      window.localStorage.getItem(SESSION_FLAG_KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function markStoredSession(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (active) {
      window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
      window.localStorage.setItem(SESSION_FLAG_KEY, "1");
    } else {
      window.sessionStorage.removeItem(SESSION_FLAG_KEY);
      window.localStorage.removeItem(SESSION_FLAG_KEY);
    }
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

export async function brigidSignup(
  name: string,
  email: string,
  password: string,
  role: Role = "owner",
): Promise<LoginResult> {
  return brigidRequest<LoginResult>("/api/brigid/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  });
}

export type PendingOAuthAccount = {
  provider: "google" | "github";
  email: string;
  name: string;
};

export async function brigidOAuthPending(): Promise<PendingOAuthAccount | null> {
  const response = await fetch("/api/auth/oauth/pending", {
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error("Could not verify your OAuth sign-up session.");
  }
  return (await response.json()) as PendingOAuthAccount;
}

export async function brigidOAuthCancel(): Promise<void> {
  await fetch("/api/auth/oauth/pending", {
    method: "DELETE",
    cache: "no-store",
  });
}

export async function brigidOAuthFinalize(role: Role): Promise<LoginResult> {
  return brigidRequest<LoginResult>("/api/auth/oauth/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

export async function brigidLogout(): Promise<{ status: string }> {
  return brigidRequest<{ status: string }>("/api/brigid/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function brigidMe(): Promise<UserSession> {
  return brigidRequest<UserSession>("/api/brigid/me");
}

export async function brigidInvoices(filters?: {
  kind?: InvoiceKind | "";
  status?: InvoiceStatus | "";
}): Promise<{ invoices: Invoice[] }> {
  const query = new URLSearchParams();
  if (filters?.kind) query.set("kind", filters.kind);
  if (filters?.status) query.set("status", filters.status);
  const qs = query.toString();
  return brigidRequest<{ invoices: Invoice[] }>(
    `/api/brigid/invoices${qs ? `?${qs}` : ""}`,
  );
}

export async function brigidInvoice(id: string): Promise<InvoiceDetailResult> {
  return brigidRequest<InvoiceDetailResult>(
    `/api/brigid/invoices/${encodeURIComponent(id)}`,
  );
}

export async function brigidTransactions(filters?: {
  direction?: TransactionDirection | "";
  from?: string;
  to?: string;
}): Promise<{ transactions: BankTransaction[] }> {
  const query = new URLSearchParams();
  if (filters?.direction) query.set("direction", filters.direction);
  if (filters?.from) query.set("from", filters.from);
  if (filters?.to) query.set("to", filters.to);
  const qs = query.toString();
  return brigidRequest<{ transactions: BankTransaction[] }>(
    `/api/brigid/transactions${qs ? `?${qs}` : ""}`,
  );
}

export async function brigidTransaction(
  id: string,
): Promise<TransactionDetailResult> {
  return brigidRequest<TransactionDetailResult>(
    `/api/brigid/transactions/${encodeURIComponent(id)}`,
  );
}

async function brigidRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(
        "Brigid took too long to respond. Please check the server and retry.",
      );
    }
    throw new Error(
      "The local Brigid service is unavailable. Check both servers and retry.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("Brigid returned an unreadable response. Please retry.");
  }
  if (!response.ok) {
    const detail =
      isRecord(data) && typeof data.detail === "string" ? data.detail : null;
    throw new Error(detail ?? `Brigid request failed (${response.status}).`);
  }
  return data as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
