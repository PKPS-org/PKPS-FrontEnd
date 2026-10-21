# PKPS: frontend web (GitHub Pages)

Situs statis untuk admin, pendamping, dan donatur; menggantikan halaman Blade Laravel. Keluarga binaan
memakai aplikasi mobile Keluarga Mandiri (`../pkps_mobile`), dan login keluarga ditolak di sini.
HTML multi-halaman + ES module vanilla, Tailwind v4 + token Preline, tanpa framework, bundler, atau CDN
saat runtime. API: `../pkps-gocroot`.

## Menjalankan lokal

```bash
npm ci
npm run dev                      # build lalu sajikan dist/ di http://localhost:5173 (API bawaan http://localhost:8080)
PKPS_API_ORIGIN=https://... npm run build
npm run check                    # CSP ketat, tanpa CDN, aset ada, semua halaman noindex
```

Backend lokal perlu `ALLOWED_ORIGINS=http://localhost:5173`. Data demo: `go run ./tools/seed-demo` di backend
(akun `admin@pkps.app`, `pendamping1@pkps.app`, `donatur@pkps.app`, sandi `password`).

## Uji peramban

```bash
docker run -d --rm --name pkps-mongo-test -p 27018:27017 mongo:7
npm run test:e2e                 # Chrome terpasang (CHROME_PATH untuk lokasi lain)
npm run test:e2e:subpath         # sama, di bawah base path /pkps-apps
```

Runner membangun situs, mengisi DB unik `pkps_e2e_*_dev` dengan seed-demo, menyalakan backend (:18080) dan situs
(:5173), lalu menguji: login per peran, penolakan akun keluarga, keluarga (buat, ubah, detail), verifikasi kebutuhan,
penilaian, donasi + konfirmasi, distribusi + kwitansi, laporan cetak, ekspor Excel, jadwal, aktivitas dengan foto,
axe terang/gelap, dan tanpa luapan di 390 px. Setiap tes gagal bila ada pelanggaran CSP atau galat skrip.

## Struktur

| Bagian | Isi |
|---|---|
| `*/index.html` | satu folder per halaman; detail memakai `?id=` |
| `assets/js/pages/` | satu modul per halaman (baris pertama `import "../common.js"`) |
| `assets/js/api.js` | klien API: amplop Laravel, 401 → login, `put`, `FormData` + `_method`, pengecilan gambar 1600 px JPEG 0,8 |
| `assets/js/auth.js` | `requireRole(...)`, penolakan akun keluarga |
| `assets/js/admin/` | kit panel (tabel, formulir, kartu), navigasi per peran, dialog, paginasi, grafik |
| `assets/js/pkps.js` | label dan lencana domain |
| `assets/css/` | `input.css` (komponen + aturan cetak A4), `themes/pkps.css` (biru langit + oranye) |

Cetak laporan dan kwitansi memakai `@media print` dan tombol "Cetak / Simpan PDF" (`window.print()`).

## Deploy

`../.github/workflows/frontend.yml`: build, check, lalu GitHub Pages. Dilewati selama variabel repo `API_BASE_URL`
(origin fungsi Cloud Functions) kosong. Base path dihitung dari nama repo; `PAGES_BASE_PATH` menimpanya
(`root` = akar domain).
