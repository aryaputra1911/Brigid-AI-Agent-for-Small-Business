# Brief Pengerjaan Phase 3 — API Baru (Login Dummy, Sesi, List & Detail)

Dokumen ini adalah spesifikasi kerja untuk **Phase 3** dari [docs/BRIGID_PLAN.md](BRIGID_PLAN.md).
Target pelaksana: **GLM 5.3 Flash**. Hasil pengerjaan akan di-review setelah selesai.

---

## 1. Tujuan & Batasan Keras

Phase 3 menambahkan **login dummy berbasis sesi** dan **endpoint baca (read-only)** pada backend FastAPI ([src/brigid/interfaces/web/app.py](../src/brigid/interfaces/web/app.py)), lengkap dengan unit/integration tests.

### Dilarang Diubah
- **Jangan ubah** `src/brigid/guard/`, `src/brigid/tools/`, `src/brigid/agent/`, maupun `src/brigid/app.py`.
- **Jangan tambah** endpoint tulis/mutasi baru (tidak ada endpoint untuk membayar, mengubah limit, mengubah mandat, atau mengubah peran). Pembayaran tetap hanya lewat chat → `propose_payment` → guard.
- **Jangan hapus** kompatibilitas `role` pada endpoint lama (`/api/chat`, `/api/pending`, `/api/confirm`, `/api/cancel`, `/api/mandate`, `/api/reset`) selama Phase 3. Halaman frontend baru berpindah ke sesi pada Phase 5.

---

## 2. Desain Autentikasi & Sesi Dummy

### Akun Demo
Dipetakan dari [data/seed/users.csv](../data/seed/users.csv):

| Email | Password | `user_id` | `role` | `name` |
| --- | --- | --- | --- | --- |
| `owner@brigid.demo` | `brigid123` | `user-owner` | `owner` | `Sari` |
| `bookkeeper@brigid.demo` | `brigid123` | `user-bookkeeper` | `bookkeeper` | `Dewi` |
| `staff@brigid.demo` | `brigid123` | `user-staff` | `staff` | `Rudi` |

> [!NOTE]
> `create_web_app(app, principals, hosts)` menerima `principals: Mapping[str, Principal]`. Gunakan `principals.get(role)` agar tetap bekerja dengan test fixture (`world`, `ready`) maupun seed data.

### Session Store & Resolusi Principal
- Simpan sesi di memori server (`dict[str, Principal]` dilindungi `threading.Lock`).
- Token dibuat dengan `secrets.token_urlsafe(32)`.
- Nama cookie: `brigid_session` (`httponly=True`, `samesite="lax"`, `path="/"`).
- Ekstraksi token dari request:
  1. Header `Authorization: Bearer <token>`, atau
  2. Cookie `brigid_session`.
- **Kompatibilitas endpoint lama** (`/api/chat`, `/api/pending`, `/api/confirm`, `/api/cancel`, `/api/mandate`, `/api/reset`):
  - Jadikan field/query `role` **opsional** (`Role | None = None`).
  - Jika sesi valid ada pada request: gunakan `Principal` dari sesi. (Jika `role` juga dikirim dan berbeda dari `session_principal.role`, kembalikan `403`.)
  - Jika tidak ada sesi: fallback ke `principal(role)` jika `role` dikirim; jika `role` juga tidak ada, kembalikan `401`.
  - Dengan cara ini, seluruh tes lama di [tests/test_web.py](../tests/test_web.py) dan frontend saat ini tetap berjalan tanpa modifikasi.

---

## 3. Spesifikasi Endpoint Baru

Semua endpoint baru di bawah ini **wajib memiliki sesi valid** (`401` jika tidak ada atau tidak valid).

### 3.1 Auth & Profil
- `POST /api/login`
  - Body (`ConfigDict(extra="forbid")`): `{ "email": str, "password": str }`.
  - Cocokkan email & password (gunakan `hmac.compare_digest` untuk password). Jika tidak cocok atau role tidak ada di `principals` → `401` (`"Invalid email or password."`).
  - Buat token baru, simpan di session store, set cookie `brigid_session`, dan kembalikan:
    ```json
    {
      "token": "...",
      "user": {
        "user_id": "user-owner",
        "role": "owner",
        "business_id": "biz-toko-sari",
        "name": "Sari"
      }
    }
    ```
- `POST /api/logout`
  - Tidak wajib JSON body (boleh tanpa body atau `{}`). Catatan: perhatikan middleware `guard_requests` yang mewajibkan `Content-Type: application/json` untuk semua method selain `GET`/`HEAD` — tes dan client harus mengirim `Content-Type: application/json` (atau `json={}`).
  - Hapus token dari session store (jika ada), hapus cookie `brigid_session`, kembalikan `{"status": "logged_out"}`.
- `GET /api/me`
  - Wajib sesi valid (`401`).
  - Kembalikan `{"user_id": ..., "role": ..., "business_id": ..., "name": ...}`.

### 3.2 Invoices
- `GET /api/invoices`
  - Query params opsional:
    - `kind`: `"payable"` | `"receivable"` (422 jika nilai lain)
    - `status`: `"open"` | `"paid"` | `"void"` (422 jika nilai lain)
  - Perilaku per peran (`SimEnvironment.list_invoices`):
    - Jika `kind` diberikan: panggil `app.env.list_invoices(p, kind, status=status)`. Jika `AccessDenied` (mis. `staff` meminta `kind="payable"`) → `403`.
    - Jika `kind` tidak diberikan:
      - `staff`: hanya ambil `"receivable"`.
      - `owner` / `bookkeeper`: gabungkan `"payable"` dan `"receivable"`, urutkan konsisten (mis. `(due_date, id)`).
  - Kembalikan `{"invoices": [...]}` dengan tiap item berisi field `Invoice` yang aman:
    - `id`, `kind`, `counterparty_id`, `counterparty_name`, `number`, `amount` (string/number JSON), `currency`, `issue_date`, `due_date`, `status`, `late_fee_bearing`.
    - `stated_account`: **wajib di-mask** (jika tidak `None`), misalnya `•••• 4821` (atau `••••` jika panjang < 4).
    - `document_text`: plain string apa adanya (atau `None`).
    - `needs_review`: `bool` — hasil screening `document_text` (jika ada) menggunakan `app.guard.screen_untrusted(...)` (`verdict.suspicious`).
- `GET /api/invoices/{invoice_id}`
  - Cari invoice pada list yang boleh diakses `principal` (`staff` hanya `"receivable"`, `owner`/`bookkeeper` keduanya). Jika tidak ditemukan → `404`.
  - Jika `owner` atau `bookkeeper` dan `invoice.kind == "payable"`, sertakan objek `supplier` (dari `app.env.get_supplier`, tangani `NotFound` dengan `None`):
    `{"id": ..., "name": ..., "account_verified": ..., "verified_account": "<masked>"}`.
  - Kembalikan `{"invoice": {...}, "supplier": ...}`.

### 3.3 Transactions
- `GET /api/transactions`
  - Hanya `owner` dan `bookkeeper` (`staff` → `403` dari `AccessDenied`).
  - Query params opsional:
    - `direction`: `"in"` | `"out"` (422 jika nilai lain)
    - `from` (Python alias `start_date: dt.date | None = Query(default=None, alias="from")`): default `end - timedelta(days=90)`
    - `to` (Python alias `end_date: dt.date | None = Query(default=None, alias="to")`): default `app.today()`
  - Validasi `start <= end` (jika `start > end` → `400` atau `422`).
  - Panggil `app.env.list_transactions(p, start, end)`. Jika `direction` diberikan, filter `t.direction == direction`.
  - Kembalikan `{"transactions": [...]}` dengan tiap item menyertakan field `BankTransaction` (`id`, `date`, `amount`, `direction`, `counterparty`, `memo`, `reference`) + `needs_review: bool` (hasil screening `memo` dengan `app.guard.screen_untrusted`).
- `GET /api/transactions/{transaction_id}`
  - Hanya `owner` dan `bookkeeper` (`staff` → `403`).
  - Cari transaksi berdasarkan `transaction_id` (rentang tanggal yang mencakup seluruh data simulasi, mis. `dt.date(2000, 1, 1)` s.d. `app.today() + timedelta(days=365)`). Jika tidak ditemukan → `404`.
  - Kembalikan `{"transaction": {...}}` (termasuk `needs_review`).

### 3.4 Suppliers
- `GET /api/suppliers/{supplier_id}`
  - Panggil `app.env.get_supplier(p, supplier_id)`.
  - `AccessDenied` (`staff`) → `403`, `NotFound` → `404`.
  - Kembalikan `{"supplier": {"id", "name", "verified_account": "<masked>", "account_verified", "avg_invoice_amount"}}`.
  - **Nomor rekening `verified_account` wajib di-mask** (tidak boleh ada nomor rekening utuh di response).

---

## 4. Aturan Keamanan & Error Mapping

1. **Mapping Error Environment**:
   - `AccessDenied` → HTTP `403`
   - `NotFound` → HTTP `404`
   - `ToolFailure` / `ToolTimeout` → HTTP `503`
2. **Masking Rekening**:
   - Buat helper `mask_account(account: str | None) -> str | None`: bersihkan spasi/pemisah atau ambil 4 karakter terakhir non-whitespace (`•••• XXXX`). Pastikan nomor rekening penuh tidak pernah muncul di `response.text`.
3. **Screening Data Eksternal**:
   - Gunakan `app.guard.screen_untrusted(text, principal=p, session_id=f"web-api:{p.user_id}", source="data", origin=...)`.
   - Hanya ekspos `needs_review: bool` (`verdict.suspicious`), jangan bocorkan detail internal model/prompt.
4. **Security Headers & CSRF Guard**:
   - Middleware `guard_requests` tetap aktif pada semua route.

---

## 5. Daftar Tes yang Harus Ditambahkan

Tambahkan tes komprehensif (di `tests/test_web.py` atau file baru `tests/test_web_api.py`):
1. **Auth**:
   - Login sukses untuk `owner`, `bookkeeper`, `staff` (mengembalikan token + set cookie `brigid_session`).
   - Login gagal (password salah, email tidak dikenal, extra field) → `401` / `422`.
   - `GET /api/me` dengan cookie atau Bearer token → `200`; tanpa sesi → `401`.
   - `POST /api/logout` membatalkan sesi sehingga `GET /api/me` berikutnya → `401`.
   - Endpoint lama (`/api/chat`, `/api/pending`) bisa dipanggil dengan sesi tanpa `role`, dan menolak `role` yang tidak cocok dengan sesi (`403`).
2. **Invoices**:
   - `owner`/`bookkeeper` dapat melihat `payable` dan `receivable`, filter `kind` & `status` bekerja.
   - `staff` hanya melihat `receivable`; meminta `kind=payable` → `403`; meminta detail invoice `payable` → `404`.
   - `stated_account` pada response ter-mask (nomor asli tidak ada di `response.text`).
   - Invoice yang memiliki teks injeksi (`flagged_invoice_ids`) memiliki `needs_review == True`.
   - Detail invoice `payable` menyertakan supplier dengan `verified_account` ter-mask; id tidak dikenal → `404`.
3. **Transactions**:
   - `owner`/`bookkeeper` dapat list & detail, filter `direction`, `from`/`to`, dan error saat `from > to`.
   - `staff` mendapat `403` untuk list maupun detail.
   - Transaction id tidak dikenal → `404`.
4. **Suppliers**:
   - `owner`/`bookkeeper` mendapat detail supplier dengan `verified_account` ter-mask (nomor asli tidak ada di `response.text`).
   - `staff` mendapat `403`; id tidak dikenal → `404`.

---

## 6. Checklist Verifikasi Sebelum Selesai

Jalankan semua perintah berikut setelah perubahan terakhir dan pastikan seluruhnya lulus:
```bash
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run python -m eval.offline --check
```
