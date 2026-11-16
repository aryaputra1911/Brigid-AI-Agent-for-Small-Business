# Tahap 6: Landing Page Redesign & Video Showcase

Tanggal: 2026-11-16
Mode antislop: `during` (dikonfirmasi pengguna)

## Ringkasan Perubahan

1. **Redesign Landing Page ([landing-page.tsx](file:///home/arya/projects/brigid/frontend/components/landing/landing-page.tsx), [landing.css](file:///home/arya/projects/brigid/frontend/components/landing/landing.css))**
   - Mengadopsi struktur editorial bergrid dengan kontras tinggi (terinspirasi dari referensi `https://rre.com/?ref=lapaninja`) sambil mempertahankan identitas Brigid (`#7C2F81` / `#D59BE0`, logo Brigid, dan tipografi Poppins + Arial + monospace untuk indeks teknis).
   - **Dials:** `ENERGY 3 / RHYTHM 3 / MOTION 2`.
   - **Struktur seksi yang bervariasi:**
     - **Hero Stage (Dark `#111117`)**: Layout split asimetris antara pernyataan nilai utama dan slot video 16:9 (`LandingVideo`).
     - **01 / Architecture (`#guardrails`)**: Tesis dua kolom yang menjelaskan pemisahan antara model bahasa (proposer) dan kode deterministik (decider).
     - **02 / Capabilities (`#capabilities`)**: Daftar indeks bernomor (`01`–`04`) dengan garis pembatas tipis (`1px`), menggantikan grid kartu seragam.
     - **03 / Workflow (`#how-it-works`)**: Kolom narasi + `WorkflowDemo` interaktif berdampingan dengan daftar langkah `Chat`, `Mandate`, dan `Approvals`.
     - **04 / Simulation (`#simulation`)**: Band penutup gelap yang menjelaskan penggunaan data sintetis lokal dan mengarahkan ke `/chat`.
   - **Mobile & Aksesibilitas:** Breakpoint di `1023px`, `899px`, `767px`, dan `359px`; target sentuh minimum `44x44px`; tanpa horizontal overflow; kontrol fallback video pada layar sempit tidak terpotong (`aspect-ratio: auto` pada fallback mobile).

2. **Komponen Video Ringan ([landing-video.tsx](file:///home/arya/projects/brigid/frontend/components/landing/landing-video.tsx))**
   - Rasio aspek terkunci `16:9` untuk mencegah Cumulative Layout Shift (CLS).
   - `preload="metadata"`, `muted`, `loop`, `playsInline`.
   - Otomatis pause saat keluar viewport (`IntersectionObserver`), saat tab tidak aktif (`visibilitychange`), atau saat `prefers-reduced-motion: reduce` aktif.
   - Tombol Play/Pause `44x44px` yang dapat diakses keyboard.
   - Fallback otomatis ke panel *Simulation preview* jika file video belum diletakkan di `frontend/public/media/`.

3. **Panduan Aset Video untuk Pengguna**
   - Lokasi file: `frontend/public/media/brigid-demo.webm` (utama) dan `frontend/public/media/brigid-demo.mp4` (fallback Safari/iOS), plus opsional `frontend/public/media/brigid-demo-poster.webp`.
   - Format disarankan: WebM (VP9) + MP4 (H.264), resolusi `1280x720` (720p), tanpa audio (`-an`), durasi 10–25 detik, target ukuran < 1.5–3 MB.

## Batasan Verifikasi

- Tool `run_command` di lingkungan ini mengembalikan error izin (`/snap/antigravity-cli/24/bin/bash: permission denied`), sehingga `npm run typecheck`, `npm run lint`, `npm run build`, dan Playwright suite (`npm run test:landing`) **belum dijalankan** secara otomatis.
- Perlu dijalankan secara lokal oleh pengguna di direktori `frontend/` sebelum commit.
