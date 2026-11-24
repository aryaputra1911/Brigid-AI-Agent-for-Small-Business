# Tahap 10: Optimasi Performa End-to-End (Backend & Frontend)

Tanggal: 2026-11-24  
Cabang: `checkreview`  
Metodologi: `performance-optimization` (Measure -> Identify -> Fix -> Verify -> Guard), `test-driven-development`, `git-workflow-and-versioning`, `antislop` (`during`)

---

## 1. Ringkasan Eksekutif

Optimasi performa dilakukan secara sistematis pada seluruh komponen Brigid (backend Python/FastAPI/SQLite/Guard/Sentinel/Finance engine dan frontend Next.js 16/React 19) tanpa menambah fitur baru dan tanpa mengubah perilaku yang tampak pengguna. Setiap perubahan diawali dengan tes regresi (`test-driven-development`), diukur ulang pada kondisi identik dengan baseline, dan di-commit secara atomik satu perbaikan per commit.

### Hasil Utama
- **Backend Tool Execution (`ToolRegistry.execute`, 50 iterasi per tool)**:
  - `get_balance`: median turun dari **0.45 ms** menjadi **0.05 ms** (**-88.9%**, 8.9x lebih cepat).
  - `list_transactions`: median turun dari **2.85 ms** menjadi **0.30 ms** (**-89.5%**, 9.5x lebih cepat).
  - `list_invoices`: median turun dari **2.94 ms** menjadi **1.02 ms** (**-65.3%**, 2.9x lebih cepat).
  - `reconcile_period`: median turun dari **3.15 ms** menjadi **1.06 ms** (**-66.3%**, 3.0x lebih cepat).
  - `forecast_cashflow`: median turun dari **11.78 ms** menjadi **3.87 ms** (**-67.1%**, 3.0x lebih cepat).
- **Backend Guard Decision (`100x GuardService.propose_payment`)**:
  - Total waktu 100 evaluasi proposal pembayaran turun dari **195.87 ms** menjadi **40.92 ms** (**-79.1%**, 4.8x lebih cepat; ~0.41 ms per proposal).
- **Backend FastAPI Web API (`TestClient`, 50 iterasi per endpoint)**:
  - `GET /api/invoices`: median turun dari **5.65 ms** menjadi **2.50 ms** (**-55.8%**).
  - `GET /api/transactions`: median turun dari **6.21 ms** menjadi **2.41 ms** (**-61.2%**).
  - `GET /api/pending`: median turun dari **3.94 ms** menjadi **2.11 ms** (**-46.4%**).
  - `GET /api/info`: median turun dari **3.47 ms** menjadi **1.82 ms** (**-47.6%**).
- **Frontend Next.js 16 Production Build (Playwright Synthetic Core Web Vitals & Network Waterfall)**:
  - Permintaan jaringan pada `/invoices` turun dari **55 request** menjadi **45 request** (**-18.2%**) dan pada `/transactions` turun dari **53 request** menjadi **45 request** (**-15.1%**) setelah menonaktifkan automatic RSC viewport prefetching pada baris daftar dinamis.
  - Ukuran bundle JavaScript desktop (`1440x900`) turun hingga **59 KB** pada rute workspace (`/approvals`: **796 KB -> 737 KB**, `/mandate`: **786 KB -> 737 KB**, `/chat`: **815 KB -> 791 KB**, `/invoices` & `/transactions`: **796 KB -> 776 KB**, `/profile`: **848 KB -> 827 KB**) setelah memisahkan komponen navigasi bawah khusus mobile (`LiquidBottomNav` + WebGL shader `LiquidNavbar`) menggunakan `next/dynamic` (`{ ssr: false }`).

---

## 2. Pengukuran Baseline vs. Sesudah Optimasi

### 2.1 Backend Tool Execution (`ToolRegistry.execute`, 50 Iterasi)

| Tool | Baseline Median (ms) | Baseline p95 (ms) | After Median (ms) | After p95 (ms) | Perubahan Median |
|---|---:|---:|---:|---:|---:|
| `get_balance` | 0.45 | 0.65 | **0.05** | **0.09** | **-88.9%** |
| `list_invoices` (`payable`) | 2.94 | 4.70 | **1.02** | **1.83** | **-65.3%** |
| `list_transactions` (30 hari) | 2.85 | 4.16 | **0.30** | **0.35** | **-89.5%** |
| `reconcile_period` (30 hari) | 3.15 | 4.44 | **1.06** | **2.00** | **-66.3%** |
| `forecast_cashflow` (30 hari) | 11.78 | 17.30 | **3.87** | **5.37** | **-67.1%** |

### 2.2 Backend Guard Payment Proposal (`100x GuardService.propose_payment`)

| Metrik | Baseline (ms) | After Opt 1 (`80aa600`) | After Opt 4 (`4034fd3`) | Perubahan Total |
|---|---:|---:|---:|---:|
| `100x propose_payment` (median) | 195.87 | 187.21 | **40.92** | **-79.1%** |
| `100x propose_payment` (min) | 195.87 | 170.92 | **38.51** | **-80.3%** |

### 2.3 Backend FastAPI Endpoints (`TestClient`, 50 Iterasi)

| Endpoint | Baseline Median (ms) | Baseline p95 (ms) | After Median (ms) | After p95 (ms) | Perubahan Median |
|---|---:|---:|---:|---:|---:|
| `GET /api/info` | 3.47 | 4.70 | **1.82** | **2.44** | **-47.6%** |
| `GET /api/me` | 3.34 | 4.61 | **1.99** | **2.79** | **-40.4%** |
| `GET /api/pending` | 3.94 | 4.99 | **2.11** | **3.04** | **-46.4%** |
| `GET /api/invoices` | 5.65 | 7.20 | **2.50** | **3.37** | **-55.8%** |
| `GET /api/invoices/inv-0001` | 3.85 | 5.04 | **2.27** | **2.94** | **-41.0%** |
| `GET /api/transactions` | 6.21 | 8.12 | **2.41** | **4.10** | **-61.2%** |
| `GET /api/transactions/bt-0001` | 3.64 | 4.38 | **2.07** | **2.59** | **-43.1%** |

### 2.4 Frontend Production Routes (Playwright Synthetic Measurement, Desktop `1440x900`)

*Catatan metodologi: Pengukuran dilakukan menggunakan Playwright Chromium headless terhadap build produksi (`next build` + `next start` + FastAPI backend) pada viewport `1440x900` dengan `PerformanceObserver` untuk FCP, LCP, CLS, Long Tasks, serta pencatatan seluruh respons jaringan.*

| Route | Baseline Reqs | After Reqs | Baseline JS (KB) | After JS (KB) | Baseline Total (KB) | After Total (KB) | Baseline FCP/LCP (ms) | After FCP/LCP (ms) | CLS |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | 27 | 27 | 539 | 539 | 3872 | 3872 | 156 / 156 | **140 / 140** | 0.0021 |
| `/login` | 21 | 21 | 539 | 539 | 3840 | 3840 | 116 / 244 | **68 / 116** | 0 |
| `/chat` | 36 | 37 | 815 | **791** | 4167 | **4115** | 112 / 308 | **48 / 192** | 0 |
| `/invoices` | 55 | **45** | 796 | **776** | 1093 | **1044** | 80 / 80 | **64 / 64** | 0 |
| `/transactions` | 53 | **45** | 796 | **776** | 1081 | **1032** | 76 / 76 | **28 / 28** | 0 |
| `/approvals` | 45 | **36** | 796 | **737** | 4139 | **4061** | 72 / 152 | **32 / 112** | 0 |
| `/mandate` | 36 | 36 | 786 | **737** | 4139 | **4061** | 80 / 248 | **36 / 128** | 0 |
| `/profile` | 49 | 48 | 848 | **827** | 1126 | **1077** | 80 / 80 | **44 / 44** | 0 |

---

## 3. Ledger Percobaan Optimasi (Kept & Reverted)

| # | Commit | Target & Hipotesis | Status | Hasil Terukur | Tes Regresi |
|---|---|---|---|---|---|
| 1 | `80aa600` | **`src/brigid/guard/policy.py`, `src/brigid/guard/service.py`**: `GuardService._decide` memanggil `check_authority(...)` lalu `evaluate(...)` yang kembali memanggil `_check_authority(...)`, sehingga verifikasi tanda tangan Ed25519 dan serialisasi JSON kanonik mandat aktif berjalan dua kali setiap proposal pembayaran. Ditambahkan parameter `authority_checked: bool = False` pada `evaluate()`. | **KEPT** | Verifikasi mandat aktif turun dari 2x menjadi 1x per keputusan; `100x propose_payment` turun dari **195.87 ms** ke **187.21 ms** (min **170.92 ms**). | `tests/test_guard_service.py::test_propose_payment_verifies_the_active_mandate_once_per_decision` |
| 2 | `c55862e` | **`src/brigid/guard/policy.py`, `src/brigid/finance/reconcile.py`**: Profiling `forecast_cashflow` menunjukkan `find_duplicate` memanggil `_normalised_number` 119.600 kali dalam 50 eksekusi ($O(N^2)$) dan `reconcile` memanggil `.strip().casefold()` berulang di dalam loop kandidat bertingkat. Ditambahkan `@lru_cache(maxsize=1024)` pada `_normalised_number` serta pre-komputasi dict `bank_references` dan `book_descriptions` di `reconcile()`. | **KEPT** | `list_invoices` turun **2.94 ms -> 2.55 ms** (-13.3%); `forecast_cashflow` turun **11.78 ms -> 10.87 ms** (min **9.73 ms**). | `tests/test_policy.py::test_find_duplicate_reuses_cached_normalised_invoice_numbers` |
| 3 | `08cc7d9` | **`src/brigid/guard/service.py`**: `GuardService.screen_records` menghabiskan 38% waktu `forecast_cashflow` karena mengiterasi seluruh field Pydantic melalui `BaseModel.__iter__` dan menjalankan regex `_IDENTIFIER.fullmatch` 73.200 kali pada ID/status/mata uang yang sama. Ditambahkan `@lru_cache` pada `_record_field_plan(model_cls)` dan `_is_identifier(text)`, serta pembacaan langsung `record.__dict__`. | **KEPT** | `list_transactions` turun **2.85 ms -> 1.02 ms** (-64.2%); `reconcile_period` turun **3.15 ms -> 2.72 ms**; `forecast_cashflow` turun ke **10.53 ms** (min **8.95 ms**). | `tests/test_screening.py::test_screen_records_caches_identifier_checks_and_field_plans` |
| 4 | `4034fd3` | **`src/brigid/tools/sim_env.py`, `src/brigid/guard/service.py`**: `SimEnvironment` memvalidasi ulang ratusan baris SQLite ke model Pydantic immutable (`frozen=True`) pada setiap pembacaan meskipun database tidak berubah, dan `_load_mandate` mem-parsing ulang JSON mandat yang sama. Ditambahkan cache pembacaan pada `SimEnvironment` yang otomatis di-invalidate berdasarkan `self._conn.total_changes` (aman terhadap mutasi SQL langsung di tes) dan `@lru_cache(maxsize=16)` pada `_parse_mandate(payload)`. | **KEPT** | `get_balance` **0.45 -> 0.05 ms** (-88.9%); `list_invoices` **2.94 -> 1.02 ms** (-65.3%); `list_transactions` **2.85 -> 0.30 ms** (-89.5%); `reconcile_period` **3.15 -> 1.06 ms** (-66.3%); `forecast_cashflow` **11.78 -> 3.87 ms** (-67.1%); `100x propose_payment` **195.87 -> 40.92 ms** (-79.1%). | `tests/test_sim_env.py::test_repeated_reads_reuse_cached_records_until_the_database_changes` |
| 5 | `18918ca` | **`frontend/components/invoices-page.tsx`, `frontend/components/transactions-page.tsx`**: Setiap baris `<Link>` pada daftar `/invoices` dan `/transactions` memicu automatic viewport RSC prefetch (`?_rsc=...`) untuk puluhan rute dinamis saat halaman dimuat. Ditambahkan `prefetch={false}` pada link baris daftar. | **KEPT** | Request jaringan pada `/invoices` turun **55 -> 45** (-27 KB total payload, FCP/LCP **80 ms -> 64 ms**) dan pada `/transactions` turun **53 -> 45** (-27 KB total payload, FCP/LCP **76 ms -> 28 ms**). | `frontend/lib/next-config.test.ts` (`invoice and transaction list rows disable automatic RSC viewport prefetching`) |
| 6 | `d7a139c` | **`frontend/components/workspace-shell.tsx`**: `LiquidBottomNav` (yang memuat 833 baris WebGL shader `LiquidNavbar` dan ikon navigasi) diimpor secara statis meskipun hanya dirender pada layar mobile (`isMobile && !menuOpen`). Diubah menjadi lazy-load via `next/dynamic` (`{ ssr: false }`). | **KEPT** | Ukuran bundle JS desktop turun **20–59 KB** di seluruh halaman workspace (`/approvals` **796 -> 737 KB**, `/mandate` **786 -> 737 KB**, `/chat` **815 -> 791 KB**, `/invoices` & `/transactions` **796 -> 776 KB**, `/profile` **848 -> 827 KB**). | `frontend/lib/next-config.test.ts` (`workspace shell lazy-loads the mobile bottom navigation via next/dynamic`) |

---

## 4. Verifikasi Akhir & Guard Regresi

- **Backend Pytest Suite**: **1.488 passed, 1 skipped** (4 tes regresi performa baru ditambahkan; 0 kegagalan).
- **Backend Offline Evaluation (`eval.offline`)**: Seluruh skenario evaluasi deterministik dan adversarial lulus (`test_the_stored_offline_baseline_is_up_to_date` turun dari **16.28 s** pada baseline profiling menjadi **13.08 s**, **-19.7%**).
- **Backend Linter**: `uv run ruff check .` bersih (`All checks passed!`).
- **Frontend Unit Tests, Typecheck, Lint & Build**:
  - `npm run test:unit`: **28/28 lulus** (termasuk 2 guard regresi performa baru di `frontend/lib/next-config.test.ts`).
  - `npm run typecheck`: `tsc --noEmit` keluar dengan kode `0`.
  - `npm run lint`: keluar dengan kode `0` (0 error).
  - `npm run build`: build produksi Next.js 16 selesai tanpa error.
- **Playwright End-to-End & Mobile Navigation Verification**:
  - `scripts/verify-critical-pwa.cjs`, `scripts/verify-sidebar.cjs`, dan `scripts/verify-mobile-composer.cjs` dijalankan terhadap server produksi dan seluruhnya lulus (`PASS`).
