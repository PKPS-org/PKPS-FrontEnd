// Pemeriksa statis untuk dist/ (kriteria penerimaan frontend):
//  - tanpa <script> inline, handler on*=, atribut style="", atau <style> di markup
//    (CSP script-src 'self' / style-src 'self' memblokirnya)
//  - tanpa rujukan CDN atau font pihak ketiga
//  - setiap halaman punya meta CSP tanpa 'unsafe-*', dengan script-src 'self', tanpa frame-src, dan meta color-scheme
//  - aset yang dirujuk halaman ada di dist/
//  - semua penanda build (@head, @include, @icon, __API_ORIGIN__, __BASE_PATH__, __YEAR__) sudah terganti
//  - bila PKPS_BASE_PATH diisi, setiap href/src berawalan "/" memuat awalan situs itu
//  - semua halaman noindex (PKPS tidak punya landing publik)
// Keluar 1 bila ada pelanggaran.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "dist";
const BASE = (process.env.PKPS_BASE_PATH || "").trim().replace(/\/+$/, "");
const problems = [];
const htmlFiles = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith(".html")) htmlFiles.push(p);
  }
})(DIR);

if (htmlFiles.length === 0) problems.push("tidak ada HTML di dist/ (jalankan npm run build)");

for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc\s*=/.test(m[1])) problems.push(`${f}: <script> inline`);
  }
  if (/\son[a-z]+\s*=/i.test(html)) problems.push(`${f}: handler on*= inline`);
  if (/\sstyle\s*=/i.test(html)) problems.push(`${f}: atribut style=""`);
  if (/<style\b/i.test(html)) problems.push(`${f}: <style> inline`);
  if (/googleapis|gstatic|cdn\.|cdnjs|unpkg|jsdelivr|maps\.google/i.test(html)) problems.push(`${f}: rujukan CDN/pihak ketiga`);

  const csp = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/i);
  if (!csp) {
    problems.push(`${f}: tanpa meta CSP`);
  } else {
    const policy = csp[1];
    if (/frame-src/i.test(policy)) problems.push(`${f}: CSP memuat kelonggaran pihak ketiga`);
    if (!/<meta name="color-scheme"/.test(html)) problems.push(`${f}: tanpa meta color-scheme`);
    if (/unsafe-inline|unsafe-eval/.test(policy)) problems.push(`${f}: CSP memuat unsafe-*`);
    if (!/script-src 'self'/.test(policy)) problems.push(`${f}: CSP tanpa script-src 'self'`);
  }

  // Aset yang dirujuk halaman harus ada (mis. ikon, gambar, skrip); rujukan menggantung baru ketahuan di peramban.
  for (const m of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    if (m[1].startsWith("//") || !/\.[a-z0-9]+$/i.test(m[1])) continue; // hanya berkas, bukan alamat halaman
    const rel = BASE && m[1].startsWith(BASE + "/") ? m[1].slice(BASE.length) : m[1];
    if (!existsSync(join(DIR, rel))) problems.push(`${f}: aset tidak ada di dist/: ${m[1]}`);
  }

  if (BASE) {
    for (const m of html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/g)) {
      const ok = m[1] === BASE || m[1].startsWith(BASE + "/") || m[1].startsWith(BASE + "?") || m[1].startsWith(BASE + "#");
      if (!ok) problems.push(`${f}: tautan tanpa awalan situs ${BASE}: ${m[1]}`);
    }
  }

  if (/<!--@head(?::index)?-->/.test(html)) problems.push(`${f}: penanda <!--@head--> belum diganti`);
  if (/<!--@(include|icon) /.test(html)) problems.push(`${f}: penanda <!--@include/@icon ...--> belum diganti`);
  if (/__(API_ORIGIN|SITE_URL|YEAR|ROBOTS|BASE_PATH)__/.test(html)) problems.push(`${f}: penanda __...__ belum diganti`);

  const robots = (html.match(/<meta name="robots" content="([^"]*)"/) || [])[1];
  if (robots === undefined) problems.push(`${f}: tanpa meta robots`);
  else if (robots !== "noindex") problems.push(`${f}: meta robots "${robots}" (semua halaman PKPS noindex)`);
}

// JS yang dibangun juga tidak boleh menyisakan penanda.
(function walkJs(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== "vendor") walkJs(p); }
    else if (n.endsWith(".js") && /__(API_ORIGIN|BASE_PATH)__/.test(readFileSync(p, "utf8"))) problems.push(`${p}: penanda __...__ belum diganti`);
  }
})(join(DIR, "assets", "js"));

if (problems.length) {
  console.error(`GAGAL (${problems.length}):\n  - ` + problems.join("\n  - "));
  process.exit(1);
}
console.log(`OK: ${htmlFiles.length} halaman HTML memenuhi aturan CSP dan tanpa CDN`);
