# Audit Tahap 7 — Sinkronisasi Tes, Wiring, Regresi Workspace & Kebersihan Repo

Tanggal: 2026-11-16
Mode antislop: `during` (sesi)
Status: **Layak dilanjutkan** (dengan temuan yang butuh keputusan pemilik, lihat bagian 4)

## 1. Daftar Commit

| Commit | Ruang lingkup |
| --- | --- |
| `32dd135` | feat(landing): clone rre layout with ambient video and antislop rules (hasil Tahap 6 di-commit atomik: komponen landing, media demo, riset rre.com, referensi desain, laporan tahap-6, skrip qa; `.playwright-mcp/` masuk `.gitignore`, file `:Zone.Identifier` dihapus, `next-env.d.ts` dibatalkan karena hanya churn mode dev) |
| `ef370ab` | test(landing): update verify-landing suite for rre layout and interactions |
| `1303498` | fix(chat): prefill composer safely from landing prompt query |
| `1a249f5` | style(landing): format landing components |
| `b2d8c8e` | test: fall back to bundled chromium when chrome is absent |
| `534b1cd` | fix(chat): close the settings dialog when focus leaves without a target |
| `ef2d293` | test(finance): mirror real decision statuses in the confirm and draft mocks |
| `36db608` | test(sidebar): assert the width CSSTransition instead of catching a frame |
| `0f8a646` | test(chat): run against port 3000 and mock real decision statuses |
| `96ba719` | style: format the touched workspace and verification files |
| `c564371` | test(chat-intro): count only keyframe animations as intro replays |
| `7b97ec4` | test(mobile-composer): import the shared browser launcher |
| `f850463` | docs(audit): add stage 7 verification report |

## 2. Ringkasan Perubahan

### Task 1: kebersihan git

- `.playwright-mcp/` ditambahkan ke `.gitignore`; dua file `:Zone.Identifier` di
  `frontend/public/media/` dihapus (pola `*:Zone.Identifier` sudah diabaikan git sejak
  commit `56fe718`).
- `next-env.d.ts` yang berubah karena `next dev` dibatalkan ke versi HEAD (file
  autogenerasi; `next build` membuatnya kembali).

### Task 2: verify-landing untuk layout baru

- Suite ditulis ulang untuk layout `rre-*`: akordeon mengubah `aria-expanded`, slider
  skenario menggerakkan counter `01 / 04` sampai `02 / 04` dan kembali, kontrol
  pause/play video latar mengubah `aria-pressed` dengan target sentuh 44px, form
  FooterLauncher menampilkan pesan error saat dikirim kosong, drawer mobile terbuka dari
  tombol `Menu`, tertutup dengan `Escape` dan fokus kembali ke tombol `Menu`.
- Tiga viewport (1440x900, 768x1024, 390x844): nol `console.error`, nol `pageerror`,
  nol horizontal overflow, screenshot tersimpan.
- Dicek juga: skip link dan fokus ke `#landing-main`, nol panggilan API dari landing,
  dan navigasi FooterLauncher ke `/chat?prompt=...`.
- Launcher browser kini mencoba channel Chrome lalu jatuh ke chromium bawaan Playwright
  agar suite berjalan di mesin tanpa Chrome (perubahan harness, bukan asersi).

### Task 3: wiring `/chat?prompt=`

- Ditemukan `/chat` sama sekali belum membaca parameter `prompt` dari FooterLauncher.
- `WorkspaceProvider` menyeed draft dari `?prompt=` melalui `useSearchParams` pada
  initializer `useState`: plain text untuk isi textarea saja, dipangkas ke maksimum
  4000 karakter, tidak pernah dikirim otomatis, dan tidak pernah dirender sebagai HTML.
- Route workspace (`/chat`, `/approvals`, `/mandate`) kini dirender per request
  (`force-dynamic` di layout) sehingga nilai seed ada di HTML server dan hidrasi
  konsisten. Landing tetap statis.
- Suite baru `scripts/verify-chat-prefill.cjs` (`npm run test:prefill`): teks berisi
  `<img src=x onerror=alert(1)>` masuk sebagai nilai textarea murni (tidak ada elemen
  yang disuntik), tidak ada panggilan `chat` otomatis, seed dipangkas ke 4000, dan
  composer kosong tanpa `?prompt=`.

### Task 4: regresi frontend (bug nyata yang ditemukan dan diperbaiki)

1. **Dialog settings terjebak terbuka untuk role non-owner** (`534b1cd`): Tab keluar
   dari dialog pada halaman yang tidak punya elemen focusable lagi (staff di Mandate)
   membuat fokus jatuh ke `body` tanpa `relatedTarget`, sehingga `onBlur` tidak pernah
   menutup dialog. Handler kini memutuskan satu frame berikutnya apakah fokus benar-benar
   keluar, yang sekaligus menjaga dialog tetap terbuka saat tombol settings drawer
   di-unmount di tengah handoff mobile. Terungkap oleh `test:profile`.
2. **Fixture status API lama** (`ef2d293`, `0f8a646`): mock confirm/mandate menjawab
   `complete`/`pending`, status yang tidak pernah dikembalikan backend (`executed`,
   `declined`, `needs_confirmation`). Composer memetakan status tak dikenal ke tone
   error, sehingga status keputusan dan tautan "Review the request in Approvals" tidak
   pernah muncul. Fixture kini mencerminkan kontrak API.
3. **Default port `verify-chat.cjs` 3005** (`0f8a646`): satu-satunya suite yang tidak
   memakai 3000; tidak ada server di sana.
4. **Asersi animasi sidebar rapuh** (`36db608`): kurva ease-out hanya menyisakan
   sekitar satu paint di antara lebar awal dan akhir, sehingga cek lebar antara via
   polling bisa melewati seluruh animasi. Kini suite mengklik dan membaca objek
   `CSSTransition` properti `width` melalui Web Animations API (280px ke 64px dan
   sebaliknya); cek lebar akhir tetap.
5. **Pengecekan animasi intro terlalu luas** (`verify-chat-intro.cjs`, bagian dari
   `test:chat-intro`): `Element.getAnimations()` menyapu subtree, sehingga transisi
   `background-color` tombol kirim yang ter-enable saat mengetik ikut terhitung sebagai
   "replay intro". Kini hanya `CSSAnimation` (keyframe) yang dihitung.

## 3. Hasil Verifikasi

### Frontend (dari `frontend/`, build produksi di port 3000)

- `npm run typecheck`: **exit 0**
- `npm run lint`: **exit 0**
- `npm run format:check`: **exit 0**
- `npm run test:unit`: **19 tests, 19 pass, 0 fail**
- `npm run test:landing`: **PASS** (11 check: hero/metadata/skip link, video
  pause/play, akordeon, slider, error launcher, tiga viewport tanpa overflow, drawer
  mobile, navigasi `?prompt=`, nol console/page error)
- `npm run test:ui`: **PASS** (5 kelompok)
- `npm run test:sidebar`: **PASS** (3 kelompok)
- `npm run test:finance`: **PASS** (3 kelompok)
- `npm run test:profile`: **PASS** (2 kelompok)
- `npm run test:mobile-composer`: **PASS**
- `npm run test:loading`: **PASS** (2 konteks reduced-motion)
- `npm run test:background`: **PASS**
- `npm run test:prompt-mesh`: **PASS**
- `npm run test:chat-intro`: **PASS** (2 kelompok)
- `npm run test:message-motion`: **PASS**
- `npm run test:prefill`: **PASS**
- `npm run build`: **sukses**

### Backend (dari root repo)

- `uv run pytest -q`: **1474 passed, 1 skipped** (skip kondisional seed)
- `uv run ruff check .`: **bersih**
- `uv run ruff format --check .`: **144 files already formatted**
- `uv run python -m eval.offline --check`: **Same as the stored baseline.** (exit 0)

## 4. Temuan yang Butuh Keputusan Pemilik

1. **`frontend/public/media/brigid-demo.webp` berukuran 36 MB** (animated WebP 600
   frame, 1280x720) dipakai sebagai poster video latar dan gambar preview di landing.
   Ini beban unduh besar untuk halaman pertama. Saran: ekstrak satu frame statis
   (~50-100 KB) sebagai poster dan simpan animated webp untuk penggunaan lain. Tidak
   diubah diam-diam karena tampilan landing sudah disetujui.
2. **Komponen landing lama tidak lagi terpakai**: `landing-video.tsx` (menunjuk
   `brigid-demo.webm` yang tidak ada), `workflow-demo.tsx`, dan `landing-mesh.tsx`
   tidak diimpor oleh landing baru. Perlu keputusan: hapus atau pertahankan.
3. **`npm run test:workflow-demo` menguji demo landing lama** yang sudah tidak ada di
   halaman baru, sehingga suite ini tidak akan pernah hijau lagi (di luar daftar
   verifikasi Task 4). Perlu keputusan: hapus suite atau tulis ulang untuk landing baru.
4. **Dokumen frontend** (`README.md`, `DESIGN.md`, `DELIVERY-GATE.md`) masih menyebut
   "Wali" sebagai nama produk secara historis; di luar daftar 14 file Tahap 4.
5. **Satu flake teramati** pada `test:sidebar` (1 dari 8 run): tunggu `inert` setelah
   resize ke mobile kadang melebihi 30 detik, tetapi selalu lulus dalam probe terisolasi
   (8/8) dan pada run lain. Tidak ada perubahan perilaku yang terlibat; dipantau saja.

## 5. Kesimpulan

Landing baru ter-commit rapi beserta risetnya, tes landing ditulis ulang dan lulus,
wiring `/chat?prompt=` berfungsi aman dengan tesnya, seluruh regresi frontend dan
backend hijau, dan baseline evaluasi tidak berubah. Empat bug nyata ditemukan dan
diperbaiki dengan commit terpisah beserta tesnya. Tahap 7 selesai dan siap ditinjau.
