# Audit Tahap 8 — QA Menyeluruh, Kepatuhan Ketentuan, Reliabilitas, Keamanan & UI/UX

Tanggal: 2026-11-17  
Lingkup: Proyek lokal + deploy live `https://brigid-one.vercel.app`  
Mode `antislop`: `after` (audit/read-only, tanpa mengubah kode aplikasi atau perilaku yang tampak pengguna)  
Status: **Selesai diaudit — layak dilanjutkan ke fase implementasi PWA, halaman list/detail, dan perbaikan temuan**

---

## 1. Kesesuaian Ketentuan Tugas (`docs/BRIGID_PLAN.md` §3 & §4)

| # | Ketentuan (`BRIGID_PLAN.md` §3) | Status | Kondisi Aktual (Lokal & Live) |
| --- | --- | --- | --- |
| 1 | API (web service) buatan sendiri | **Sebagian (Backend ✅, Wiring Frontend ⚠️)** | Backend FastAPI (`src/brigid/interfaces/web/app.py`) sudah memiliki endpoint inti (`/api/info`, `/api/chat`, `/api/pending`, `/api/confirm`, `/api/cancel`, `/api/mandate`, `/api/reset`) serta endpoint login dummy & read-only (`/api/login`, `/api/logout`, `/api/me`, `/api/invoices`, `/api/invoices/{id}`, `/api/transactions`, `/api/transactions/{id}`, `/api/suppliers/{id}`). Namun proxy Next.js (`frontend/app/api/brigid/[action]/route.ts`) baru meneruskan 7 action lama dan belum meneruskan `Cookie`/`Set-Cookie` maupun endpoint baru. |
| 2 | Bottom Navigation Bar (mobile) | **Belum terpenuhi ❌** | `WorkspaceShell` (`frontend/components/workspace-shell.tsx`) hanya memakai sidebar desktop + drawer mobile (`≤760px`). Bottom navigation bar 5 item (`Chat · Invoices · Transactions · Approvals · Profile`) belum ada. |
| 3 | Minimal 5 halaman | **Belum terpenuhi ❌** | Route aktif saat ini hanya **4 halaman**: `/` (Landing), `/chat`, `/approvals`, dan `/mandate`. Route `/login`, `/invoices`, `/transactions`, dan `/profile` di `https://brigid-one.vercel.app` mengembalikan **HTTP 404**. |
| 4 | ≥2 halaman utama berupa list → detail | **Belum terpenuhi ❌** | `/invoices` → `/invoices/[id]` dan `/transactions` → `/transactions/[id]` belum diimplementasikan. Hanya `/approvals` yang berbentuk daftar, tanpa halaman detail. |
| 5 | PWA (manifest, service worker, offline, installable) | **Belum terpenuhi ❌** | `/manifest.webmanifest`, `/manifest.json`, dan `/sw.js` mengembalikan **HTTP 404**; `<link rel="manifest">` tidak ada di HTML; service worker tidak terdaftar; navigasi/reload saat offline gagal (`ERR_INTERNET_DISCONNECTED`). Aset ikon PWA (`brigid-180.png`, `brigid-192.png`, `brigid-512.png`, `brigid-maskable-512.png`) sudah tersedia di `frontend/public/brand/`. |

### Peta Halaman (`BRIGID_PLAN.md` §4)
- **Sudah tersedia (HTTP 200 di live):** `/`, `/chat`, `/approvals`, `/mandate`.
- **Belum tersedia (HTTP 404 di live):** `/login`, `/invoices`, `/invoices/[id]`, `/transactions`, `/transactions/[id]`, `/profile` (serta `/approvals/[id]` opsional).

---

## 2. Hasil Pengujian Sistem End-to-End & Reliabilitas

### A. Backend (`uv run`)
- **`uv run pytest -q`**: **1474 passed, 1 skipped** (`23.57s`). Yang di-skip: `tests/test_web_api.py:390` (*"Every payable counterparty exists as a supplier in this seed data"*).
- **`uv run ruff check .` & `uv run ruff format --check .`**: **Lulus** (145 file terformat rapi, 0 error).
- **`uv run python -m eval.offline --check`**: **Lulus** — `attacks held with a hostile model: 25 of 25`, `sentinel rules: 20 of 26 injections caught, 0 of 20 ordinary texts flagged`, `reconciliation F1: 1.0`, forecast cocok dengan baseline tersimpan.

### B. Frontend Statis, Unit Test & Build (`frontend/`)
- **`npm run typecheck`**: Lulus (exit 0).
- **`npm run lint`**: Lulus (exit 0).
- **`npm run format:check`**: Lulus (Prettier).
- **`npm run test:unit`**: **20/20 passed** (`decision-tone.test.ts`, `local-request.test.ts`, `next-config.test.ts`, `brigid-api.test.ts`).
- **`npx next build`**: Lulus (`/` static prerendered; `/api/brigid/[action]`, `/chat`, `/approvals`, `/mandate` dynamic).

### C. Suite Playwright Lokal (`http://127.0.0.1:3000`, mock `/api/brigid/*`)
- **11 dari 12 suite lulus pada eksekusi beruntun pertama:** `test:ui`, `test:landing`, `test:prefill`, `test:finance`, `test:sidebar`, `test:profile`, `test:loading`, `test:mobile-composer`, `test:chat-intro`, `test:prompt-mesh`, `test:background`.
- **`test:message-motion`**: Gagal 1x pada eksekusi awal (`AssertionError: Expected intermediate smooth-scroll positions` di `frontend/scripts/verify-message-motion.cjs:109`), lalu **lulus 3/3 kali** saat dijalankan ulang (indikasi *flaky timing* pada sampling frame smooth scroll).

### D. Pengujian Live (`https://brigid-one.vercel.app`) & Skenario Terburuk (Worst-Case)
1. **Konektivitas Live:**
   - `GET /api/brigid/info` → `200 OK` (`1.71s`), `roles: ["owner", "bookkeeper", "staff"]`, `screening_model: true`.
   - `GET /api/brigid/pending?role=owner` → `200 OK` (`0.82s`), `{"requests":[]}`.
   - `POST /api/brigid/chat` (live ke upstream tunnel `wheel-clear-recipients-mini.trycloudflare.com`) → **HTTP 524 Cloudflare Timeout setelah `126.03s`**. Pengujian langsung ke root tunnel juga sempat mengembalikan **502 Bad Gateway**, sementara `GET /api/info` di tunnel mengembalikan `200 OK` dan `GET /api/invoices` mengembalikan `401 {"detail":"Please sign in."}`.
2. **Backend Tidak Aktif / Error Non-JSON (simulasi route interception di live):**
   - HTTP 503 di `/chat` dan `/approvals`: UI menampilkan pesan error yang jelas beserta tombol `Retry connection` / `RETRY CONNECTION`.
   - HTTP 524 HTML (bukan JSON): UI menampilkan `"Message not completed. Brigid returned an unreadable response. Please retry."` dan **memulihkan isi draft** di composer.
3. **Input Kosong, Panjang (>4000 char), & Payload XSS:**
   - FooterLauncher kosong: tetap di `/` dan menampilkan alert `"Enter a finance question to open in Chat."`.
   - Payload XSS `"><img src=x onerror=alert(1)><script>alert(2)</script>...` + 4200 karakter di FooterLauncher & langsung via `/chat?prompt=...`: dirender murni sebagai nilai `<textarea>`, **0 elemen `<img>`/`<script>` tersuntik**, **0 dialog alert**, dan otomatis terpotong ke **4000 karakter** di `/chat`.
   - Catatan minor: `<input>` pada `FooterLauncher` belum memiliki `maxLength={4000}` (`maxLength: -1`), sehingga URL yang dikirim mencapai 4340 karakter sebelum dipotong di `/chat`.
   - Composer hanya spasi (`"    "`): tombol Send nonaktif (`disabled: true`).
4. **Double Submit, Navigasi Cepat, & Pergantian Peran:**
   - Klik + Enter + klik bersamaan pada tombol Send: hanya **1 request `POST /api/brigid/chat`** yang terkirim (terjaga oleh state `sending`).
   - Selama pengiriman berlangsung, `#role-select` ikut dinonaktifkan (`disabled: true`) dan navigasi bolak-balik `/chat` ↔ `/approvals` ↔ `/mandate` tidak menimbulkan `pageerror`.
   - Pergantian peran ke `staff`: `/mandate` menampilkan panduan *"Owner approval"* dan `/approvals` menampilkan `"0 pending requests"`.
5. **Kondisi Offline:**
   - `setOffline(true)` menyebabkan navigasi dan reload gagal dengan halaman error browser `ERR_INTERNET_DISCONNECTED` (belum ada service worker / offline fallback).

---

## 3. Audit Performa, Keamanan, & UI/UX

### A. Performa & Bobot Aplikasi
- **Landing `/` (`390x844` & `1440x900`):** LCP `264 ms` (mobile) / `416 ms` (desktop), CLS `0`, `longTaskMs: 0`. Namun total transfer mencapai `3051 KB` akibat aset `public/media/brigid-demo.mp4` (`3,117,769 B` / `~3.0 MB`), dan terdapat **2 elemen `<video>`** (`AmbientVideoBg` + `rre-footer__cutout-video`) yang masing-masing mem-buffer `20s` meski `preload="metadata"`.
- **Chat `/chat` (`390x844` & `1440x900`):** CLS `0`, LCP `2724 ms` (mobile) / `1424 ms` (desktop). Terdapat **5 WebGL `<canvas>`** (`GrainGradient` + 4 `PromptMesh`), dengan akumulasi **`longTaskMs: 909 ms` (mobile)** dan **`6324 ms` (desktop 1440px)** selama fase muat & interaksi awal.
- **Bundle Next.js (`.next/static`):** Total `1.2 MB`; chunk JS terbesar `224 KB` (`229,597 B`), `155 KB`, `140 KB`, `110 KB`.

### B. Keamanan
- **Proxy Guard (`frontend/lib/local-request.ts` & `frontend/app/api/brigid/[action]/route.ts`):**
  - Terbukti menolak `Origin: https://evil.example` (`403 Refused.`), `Content-Type: text/plain` (`403 Refused.`), dan `Host: evil.example` (`404 DEPLOYMENT_NOT_FOUND` di Vercel).
  - Celah minor/pertahanan: `isLocalRequest` mengizinkan `origin === null` (request non-browser atau strip Origin), dan `forward()` tidak memiliki `AbortSignal.timeout(...)` sehingga request ke backend yang menggantung akan menunggu hingga timeout platform (terlihat saat 524 Cloudflare `126s`).
- **Security Headers (`frontend/next.config.ts`):**
  - `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, dan `Strict-Transport-Security` aktif di live.
  - Belum ada direktif CSP lengkap (`default-src`, `script-src`, `object-src`, `base-uri`) maupun `Referrer-Policy` di `next.config.ts` (berbeda dengan backend FastAPI yang sudah mengirimkannya).
- **Backend & Ed25519 (`src/brigid/guard/signing.py`, `src/brigid/tools/sim_env.py`, `src/brigid/interfaces/web/app.py`):**
  - Verifikasi tanda tangan Ed25519, masa berlaku token konfirmasi, single-use, dan batas akses peran (`staff` hanya receivable; `owner` untuk mandate) berjalan dan teruji di `pytest` serta `eval.offline`.
  - **Paparan Tunnel Publik:** Endpoint backend di `wheel-clear-recipients-mini.trycloudflare.com` dapat diakses langsung dari internet tanpa melewati proxy Vercel. Karena endpoint lama (`/api/chat`, `/api/pending`, `/api/confirm`, `/api/mandate`, `/api/reset`) masih menerima `role` di body/query ketika tidak ada cookie sesi, siapa pun yang mengetahui URL tunnel dapat berinteraksi langsung sebagai `owner`.

### C. UI/UX & Aksesibilitas
- **Responsivitas (`320`, `360`, `390`, `430`, `768`, `1024`, `1440` px):** **0 horizontal overflow** di seluruh halaman (`/`, `/chat`, `/approvals`, `/mandate`).
- **Fokus Keyboard:** Skip link `"Skip to content"` dan outline `:focus-visible` (`2px`) tampil konsisten pada seluruh tombol/tautan utama yang diuji.
- **Kontras Teks:** Elemen `.paper-disclaimer` di `frontend/components/ui/ai-assistant-interface.tsx:449` menggabungkan warna `rgba(255, 255, 255, 0.68)` dengan kelas Tailwind `opacity-50`, menghasilkan opasitas efektif `~0.34` yang berisiko gagal standar kontras WCAG AA (`4.5:1`).
- **Tap Target `< 44px`:**
  - Tombol `Model selection, coming soon` (`20x20` di mobile, `87x20` di desktop — berstatus `disabled`).
  - Input `FooterLauncher` di landing (`36px` tinggi).
  - `<textarea>` di `/chat` (`28px` tinggi awal sebelum tumbuh).
  - Tautan `CHAT` di navigasi header landing desktop (`42x44` px).

---

## 4. Daftar Temuan Terurut Berdasarkan Keparahan & Rekomendasi

### Critical
1. **Kepatuhan Ketentuan Wajib Tugas Belum Lengkap (Halaman, List→Detail, Bottom Nav, PWA)**
   - **Lokasi:** `frontend/app/` (hanya 4 route), `frontend/components/workspace-shell.tsx` (tanpa bottom nav), ketiadaan `manifest.webmanifest` & `sw.js`.
   - **Dampak:** Tidak memenuhi checklist wajib di `docs/BRIGID_PLAN.md` §3 (minimal 5 halaman, ≥2 halaman list → detail, bottom navigation bar mobile, dan PWA/offline).
   - **Rekomendasi:** Implementasikan route `/login`, `/invoices`, `/invoices/[id]`, `/transactions`, `/transactions/[id]`, dan `/profile`; tambahkan bottom navigation bar 5 item untuk viewport mobile; wire proxy `/api/brigid/[action]` untuk meneruskan cookie sesi & endpoint baru; serta tambahkan `manifest.webmanifest` + service worker dengan fallback offline.

### High
2. **Live Chat Mengalami Timeout 524 (`126s`) & Proxy Tidak Memiliki Timeout Request**
   - **Lokasi:** Upstream tunnel `wheel-clear-recipients-mini.trycloudflare.com` dan `frontend/app/api/brigid/[action]/route.ts` (`forward()`).
   - **Dampak:** Pengguna live di `https://brigid-one.vercel.app/chat` gagal mendapat balasan setelah menunggu >2 menit; proxy Next.js menggantung hingga platform/Cloudflare memutus koneksi.
   - **Rekomendasi:** Periksa kesehatan proses backend & panggilan model LLM pada server tunnel; tambahkan `AbortSignal.timeout(...)` (mis. 25–30s) di `forward()` dan `brigidRequest()` agar kegagalan upstream cepat tertangani dengan pesan error yang ramah.

3. **Backend Tunnel Terekspos Publik & Masih Menerima `role` Tanpa Sesi**
   - **Lokasi:** `src/brigid/interfaces/web/app.py` (`actor()`, `guard_requests()`) dan konfigurasi `trycloudflare.com`.
   - **Dampak:** Pihak yang mengetahui URL tunnel dapat memanggil `/api/chat` atau `/api/mandate` langsung sebagai `owner` tanpa autentikasi sesi dan tanpa melewati proxy Vercel.
   - **Rekomendasi:** Sesuai rencana `BRIGID_PLAN.md` §5, setelah frontend beralih ke login sesi, hapus fallback `role` tanpa sesi di endpoint lama dan batasi akses tunnel hanya untuk origin/token proxy yang sah (atau shared secret header antara proxy Next.js dan FastAPI).

### Medium
4. **Main-Thread Long Tasks Tinggi di `/chat` (`6324 ms` Desktop / `909 ms` Mobile)**
   - **Lokasi:** `frontend/components/ui/chat-background.tsx` (`GrainGradient`) dan `frontend/components/ui/prompt-card.tsx` (`PromptMesh`).
   - **Dampak:** 5 instance WebGL `<canvas>` aktif membebani main thread pada fase awal muat halaman `/chat`.
   - **Rekomendasi:** Gunakan satu shared canvas atau tunda inisialisasi `PromptMesh` sampai kartu masuk viewport/interaksi, serta evaluasi penurunan `maxPixelCount` atau penggunaan CSS fallback pada perangkat berdaya rendah.

5. **Kontras Teks `.paper-disclaimer` Terlalu Rendah (`opacity` Ganda)**
   - **Lokasi:** `frontend/components/ui/ai-assistant-interface.tsx:449` (`className="paper-disclaimer my-4 opacity-50"`).
   - **Dampak:** `rgba(255, 255, 255, 0.68)` dikalikan `opacity: 0.5` menghasilkan kontras efektif `~0.34`, sulit dibaca pada layar mobile maupun desktop.
   - **Rekomendasi:** Hapus `opacity-50` atau sesuaikan warna `.paper-disclaimer` di `workspace.css` agar memenuhi rasio kontras WCAG AA (≥4.5:1).

6. **Aset Video `brigid-demo.mp4` (`3.0 MB`) Dimuat Dua Kali di Landing Page**
   - **Lokasi:** `frontend/components/landing/ambient-video-bg.tsx` dan `frontend/components/landing/landing-page.tsx:285`.
   - **Dampak:** Pada jaringan seluler lambat, pemuatan dan buffering dua tag `<video>` mengonsumsi bandwidth ~3 MB lebih dan dapat mengganggu pemutaran di perangkat low-end.
   - **Rekomendasi:** Pertimbangkan kompresi ulang video lebih agresif untuk mobile, gunakan `preload="none"` + `IntersectionObserver` untuk video footer, atau hormati `navigator.connection?.saveData`.

7. **CSP & Security Headers Next.js Belum Selengkap Backend**
   - **Lokasi:** `frontend/next.config.ts`.
   - **Dampak:** Tidak ada `Referrer-Policy` maupun direktif CSP seperti `default-src`, `object-src 'none'`, `base-uri 'none'` di level Next.js.
   - **Rekomendasi:** Tambahkan `Referrer-Policy: no-referrer` (atau `strict-origin-when-cross-origin`) dan perketat CSP di `next.config.ts`.

### Low
8. **Tap Target `< 44px` pada Beberapa Kontrol Input & Header**
   - **Lokasi:** Input `FooterLauncher` (`36px` tinggi), `<textarea>` composer awal (`28px` tinggi), link `CHAT` header desktop (`42x44`), tombol `Model selection, coming soon` (`20x20`/`87x20`, disabled).
   - **Dampak:** Mengurangi kenyamanan sentuh pada layar kecil (kecuali tombol disabled).
   - **Rekomendasi:** Naikkan tinggi minimum wrapper sentuh input `FooterLauncher` dan area klik `<textarea>` composer menjadi ≥44px.

9. **`FooterLauncher` Belum Membatasi `maxLength={4000}`**
   - **Lokasi:** `frontend/components/landing/footer-launcher.tsx`.
   - **Dampak:** Pengguna dapat mengetik >4000 karakter lalu menghasilkan URL `/chat?prompt=...` yang sangat panjang sebelum dipotong di `/chat`.
   - **Rekomendasi:** Tambahkan `maxLength={4000}` pada `<input>` di `FooterLauncher`.

10. **Tes `verify-message-motion.cjs` Bersifat Flaky Saat Beban CPU Tinggi**
    - **Lokasi:** `frontend/scripts/verify-message-motion.cjs:109`.
    - **Dampak:** Gagal 1x pada eksekusi beruntun sebelum lulus 3/3 saat dijalankan ulang.
    - **Rekomendasi:** Tambah toleransi atau gunakan mekanisme observasi `scrollend` / `requestAnimationFrame` yang lebih deterministik pada tes smooth-scroll.
