# Audit Tahap 5 — Header Keamanan & Penguatan Cakupan Uji

Status: **Layak dilanjutkan ke Tahap berikutnya** (catatan verifikasi browser lokal masih
terblokir karena binary Chrome untuk Playwright tidak tersedia di environment ini, status
yang sama dengan laporan Tahap 2 sampai 4).

## 1. Daftar Commit

- `4f77ed8` fix(security): send security headers with the CSRF refusal
- `87d17ef` fix(security): carry strict headers on proxy error responses
- `e9a341e` test: cover CSRF null origin, case-insensitive login email, and session-role
  mismatch
- (commit ini) docs(audit): add stage 5 audit report

## 2. Perubahan yang Diverifikasi

### Header keamanan pada penolakan CSRF (backend)

- `guard_requests` di `src/brigid/interfaces/web/app.py`: `JSONResponse` 403 yang di-return
  lebih awal sebelumnya melewati `response.headers.update(SECURITY_HEADERS)` pada jalur
  normal, sehingga penolakan CSRF keluar tanpa header keamanan. Sekarang response tersebut
  membawa `headers=SECURITY_HEADERS`.
- Tes `test_the_csrf_guard_covers_login_and_logout` di `tests/test_web_api.py` kini
  memastikan keempat respons 403 (login dan logout, content-type salah dan Origin asing)
  membawa `X-Content-Type-Options: nosniff` dan `Cache-Control: no-store`.

### Header keamanan pada error response proxy Next.js (frontend)

- `frontend/app/api/brigid/[action]/route.ts`: respons yang dibuat proxy sendiri (404 aksi
  tidak dikenal, 403 Origin/Host tidak lokal, 403 content-type bukan JSON, 400 JSON tidak
  valid, dan 503 backend tidak tersedia) sebelumnya tidak membawa `Cache-Control: no-store`
  dan `X-Content-Type-Options: nosniff` seperti respons hasil `forward()`.
- Helper baru `jsonError(detail, status)` di file yang sama membangun semua error tersebut
  dengan kedua header, dan dipakai di seluruh titik error termasuk 503 di `forward()`.

### Penguatan cakupan uji web API (backend)

- `Origin: null` pada request mutasi (`POST /api/login`) ditolak 403: `urlsplit("null")`
  tidak menghasilkan hostname lokal.
- `POST /api/login` dengan email `"  OWNER@BRIGID.DEMO  "` tetap 200: email dinormalisasi
  (strip dan lowercase) sebelum dibandingkan dengan tabel akun demo.
- `role` di body yang tidak cocok dengan sesi aktif ditolak 403 pada `/api/confirm`,
  `/api/cancel`, `/api/mandate`, dan `/api/reset`; asersi pesan menegaskan penolakan berasal
  dari pemeriksaan sesi (`"That role does not match your session."`), bukan dari pemeriksaan
  role internal endpoint, dan terjadi sebelum logika endpoint berjalan.

## 3. Hasil Verifikasi

### Backend (dari root repo)

- `uv run pytest -q`: **1474 passed, 1 skipped** (skip kondisional: semua counterparty
  payable pada seed ada di suppliers.csv).
- `uv run ruff check .`: **bersih**.
- `uv run ruff format --check .`: **136 files already formatted**.
- `uv run python -m eval.offline --check`: **Same as the stored baseline.** (exit 0)

### Frontend (dari `frontend/`)

- `npm run typecheck`: **Lulus** (exit 0).
- `npm run lint`: **Lulus** (exit 0).
- `npm run format:check`: **Lulus** (exit 0).
- `npm run test:unit`: **19 tests, 19 pass, 0 fail**.
- `npm run build`: **Sukses** (exit 0).

### Verifikasi browser (opsional)

- `npm run test:loading`, `test:landing`, `test:workflow-demo`, `test:ui`: **Terblokir
  environment** — skrip memakai channel Chrome yang tidak terpasang, dan pemasangan
  dependensi sistem Chromium membutuhkan sudo yang tidak tersedia. Perlu dijalankan ulang
  di environment dengan Chrome.

## 4. Catatan (Non-Blocking)

- Tidak ada perubahan perilaku yang tampak pengguna selain penambahan header keamanan pada
  respons 403/400/404/503, yang merupakan perbaikan yang diminta.
- Aturan "jangan membaca file .ico" dipatuhu: `favicon.ico` hanya disinggung sebagai path
  pada konfigurasi, tidak pernah dibuka.
- Setiap perbaikan dituangkan dalam satu commit kecil beserta tesnya.

## 5. Kesimpulan

Kedua celah header keamanan (penolakan CSRF di backend dan error response proxy di
frontend) sudah tertutup dengan tesnya, cakupan uji web API bertambah enam kasus baru,
dan seluruh check backend serta frontend hijau dengan baseline evaluasi tidak berubah.
Tahap 5 dinyatakan selesai dan siap ditinjau.
