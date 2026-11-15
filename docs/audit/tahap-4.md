# Audit Tahap 4 — Rebranding Akhir, Perbaikan Keamanan & Cakupan Uji

Status: **Layak dilanjutkan ke Tahap 5** (dengan catatan verifikasi browser lokal masih terblokir
karena binary Chrome untuk Playwright tidak tersedia di environment ini).

## 1. Daftar Commit

- `da48531` fix(frontend): replace remaining Wali UI strings with Brigid
- `f8c33bb` fix(security): normalize Content-Type comparison in CSRF guards
- `4ae5a3d` fix(security): invalidate prior session on re-login and logout
- `882aa6f` test: add CSRF auth tests, invoice detail review test, and brigid-api unit tests
- (commit ini) docs(audit): add stage 4 audit report

## 2. Perubahan yang Diverifikasi

### Rebranding string UI

- 38 kemunculan "Wali" pada 14 file diganti menjadi "Brigid": landing page, landing
  interactions, workflow demo, workspace shell/provider, approvals, mandate, finance UI,
  AI assistant interface, dan lima skrip verifikasi (`verify-loading.cjs`,
  `verify-chat.cjs`, `verify-landing.cjs`, `verify-workflow-demo.cjs`,
  `verify-chat-intro.cjs`). `id="wali-help-title"` menjadi `brigid-help-title`.
- Class CSS `.wl-*` dan file `.ico` tidak disentuh, sesuai instruksi.
- `grep -rni wali frontend/components frontend/scripts frontend/app frontend/lib`
  kini bersih. Sisa kemunculan hanya di dokumen frontend (`README.md`, `DESIGN.md`,
  `DELIVERY-GATE.md`) yang mendeskripsikan produk secara historis dan berada di luar daftar
  14 file dari instruksi.
- Teks UI yang berubah bersifat user-visible, tetapi secara eksplisit diminta pada
  instruksi Tahap 4.

### Normalisasi Content-Type

- `guard_requests` di `src/brigid/interfaces/web/app.py` kini melakukan `.lower()` pada
  media type sebelum membandingkannya dengan `application/json` (media type bersifat
  case-insensitive menurut RFC 9110).
- `frontend/app/api/brigid/[action]/route.ts` melakukan `.toLowerCase()` yang sama.
- Tes baru `test_a_json_media_type_in_any_letter_case_is_accepted` di `tests/test_web.py`
  memastikan `Content-Type: Application/JSON; charset=utf-8` diterima (200).

### Rotasi dan pembersihan sesi

- `POST /api/login` kini menghapus sesi yang disajikan request (cookie `brigid_session`
  atau header Bearer) sebelum menerbitkan token baru, sehingga login ulang tidak
  meninggalkan token usang yang masih valid.
- `POST /api/logout` menghapus semua token yang dikirim request (Bearer dan cookie dapat
  dikirim bersamaan; keduanya dihapus).
- Ekstraksi token dirapikan ke helper `presented_tokens` yang dipakai login, logout, dan
  resolusi sesi.
- Tes baru: re-login membuat token lama 401, logout menghapus token Bearer sekaligus
  cookie. Perbaikan kecil: `login` kini menerima parameter `request` (sempat hilang pada
  draft pertama dan tertangkap oleh ruff F821 sebelum commit).

### Tambahan cakupan uji

- `tests/test_web_api.py`: middleware CSRF menolak `POST /api/login` dan `POST /api/logout`
  dengan `Content-Type` non-JSON maupun Origin asing (403); `GET /api/invoices/inv-0094`
  mengembalikan `needs_review: true`, `stated_account` ter-mask, dan supplier dengan
  `verified_account` ter-mask.
- `frontend/lib/brigid-api.test.ts` (baru, 7 kasus): URL proxy, query param `role`
  ter-encode, header/body JSON, `cache: "no-store"`, error jaringan, respons non-JSON,
  dan detail error server (dengan dan tanpa `detail`), semuanya dengan fetch mock.
- Terdaftar di `test:unit` pada `frontend/package.json`.

## 3. Hasil Verifikasi

### Backend (dari root repo)

- `uv run pytest -q`: **1468 passed, 1 skipped** (skip kondisional: semua counterparty
  payable pada seed ada di suppliers.csv).
- `uv run ruff check .`: **bersih**.
- `uv run ruff format --check .`: **135 files already formatted**.
- `uv run python -m eval.offline --check`: **Same as the stored baseline.** (exit 0)

### Frontend (dari `frontend/`)

- `npm run typecheck`: **Lulus** (exit 0).
- `npm run lint`: **Lulus** (exit 0).
- `npm run format:check`: **Lulus** (exit 0).
- `npm run test:unit`: **19 tests, 19 pass, 0 fail**.
- `npm run build`: **Sukses** (prerender static selesai tanpa error).

### Verifikasi browser (opsional)

- `npm run test:loading`, `test:landing`, `test:workflow-demo`, `test:ui`: **Terblokir
  environment**. Skrip memakai channel Chrome (`chromium.launch({ channel: "chrome" })`)
  yang tidak terpasang di `/opt/google/chrome/chrome`; instalasi dependensi sistem Chromium
  membutuhkan sudo yang tidak tersedia. Ini status yang sama dengan laporan Tahap 2 dan 3.

## 4. Catatan (Non-Blocking)

- Sisa "Wali" di dokumen frontend (`README.md`, `DESIGN.md`, `DELIVERY-GATE.md`) bukan teks
  UI dan tidak termasuk daftar instruksi; dapat dirapikan pada tahap pembersihan dokumen
  berikutnya.
- `brigid-mono.svg` tidak diubah pada tahap ini dan tetap satu-satunya aset `currentColor`.
- Verifikasi browser perlu dijalankan ulang di environment dengan Chrome terpasang.

## 5. Kesimpulan

Seluruh perbaikan Tahap 4 selesai dalam lima commit kecil, masing-masing dengan tesnya.
Semua check backend dan frontend hijau; baseline evaluasi tidak berubah. Tahap 4 dinyatakan
selesai dan siap ditinjau.
