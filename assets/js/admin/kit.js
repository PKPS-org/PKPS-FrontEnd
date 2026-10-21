// Pembantu bersama halaman panel (admin, pendamping, donatur): kelas gaya, tabel, bidang formulir, dan status di URL.
// Semua DOM dibangun dengan h() (createElement/textContent), tanpa innerHTML.
import * as api from "../api.js";
import * as auth from "../auth.js";
import { h, icon, scrollRegion, setBusy, showFormError } from "../ui.js";
import { renderAdminNav } from "./nav.js";

// Kelas komponen terpusat (lihat @layer components di input.css).
export const INPUT = "input";
export const BTN = "btn btn-outline btn-sm";
export const BTN_PRIMARY = "btn btn-primary";
export const BTN_DANGER = "btn btn-danger btn-sm";
export const BTN_DANGER_SOLID = "btn btn-danger-solid";
export const CARD = "card";
export const LINK = "link";

// Halaman panel dimulai dengan ini: memastikan peran (bawaan: semua peran web) lalu memasang navigasi.
// false = halaman berpindah.
export async function startPage(active, roles = auth.WEB_ROLES) {
  if (!(await auth.requireRole(...roles))) return false;
  renderAdminNav(active);
  return true;
}

// ── Bidang formulir ──
export function field(id, label, control, hint) {
  control.id = id;
  if (hint) control.setAttribute("aria-describedby", id + "-hint");
  return h("div", {},
    h("label", { for: id, class: "label", text: label }),
    control,
    hint ? h("p", { id: id + "-hint", class: "hint", text: hint }) : null);
}

// options: [[nilai, teks], ...]
export function select(options, value, attrs = {}) {
  const el = h("select", { class: "select", ...attrs }, options.map(([v, t]) => h("option", { value: v, text: t })));
  if (value != null) el.value = value;
  return el;
}

// ── Tabel ──
// columns: [teks, ...]; rows: larik baris, tiap baris larik sel (simpul atau teks).
// Pembungkus yang dapat digulir wajib fokus-able dan berlabel (aksesibilitas gulir keyboard).
export function table(label, columns, rows) {
  return scrollRegion(h("div", { class: "card overflow-x-auto" },
    h("table", { class: "tbl" },
      h("caption", { class: "sr-only", text: label }),
      h("thead", {}, h("tr", {}, columns.map((c) => h("th", { scope: "col", text: c })))),
      h("tbody", {}, rows.map((r) => h("tr", {}, r.map((cell) => h("td", {}, cell))))))), label);
}

// ico: "search" untuk hasil pencarian kosong; "check-circle" untuk kosong yang menggembirakan (mis. antrean bersih).
export function emptyState(text, ico = "search") {
  return h("div", { class: "rounded-2xl border border-dashed border-line-3 px-6 py-14 text-center" },
    h("span", { class: "mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground-1" }, icon(ico, "size-5")),
    h("p", { class: "mt-4 text-sm text-muted-foreground-1", text }));
}

export function errorState(message, retry) {
  return h("div", { role: "alert", class: "alert alert-error flex flex-wrap items-center gap-3" },
    h("span", { text: message }),
    retry ? h("button", { type: "button", class: BTN, on: { click: retry }, text: "Coba lagi" }) : null);
}

export function loadingState(text = "Memuat...") {
  return h("p", { role: "status", class: "py-6 text-sm text-muted-foreground-1", text });
}

// Avatar inisial: warna dipilih dari nama sehingga orang yang sama selalu berwarna sama.
const AVATAR_TONES = [
  "bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-100",
  "bg-marker-soft text-marker-ink",
  "bg-muted text-foreground",
];
export function avatar(name, size = "size-9") {
  const words = String(name || "?").trim().split(/\s+/).filter(Boolean);
  const initials = ((words[0] || "?")[0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return h("span", { class: `grid ${size} shrink-0 place-items-center rounded-full text-xs font-semibold ${AVATAR_TONES[hash % AVATAR_TONES.length]}`, "aria-hidden": "true", text: initials });
}

// ── Status di URL (dapat dibagikan, tombol kembali tetap benar) ──
export function readQuery(defaults) {
  const p = new URLSearchParams(location.search);
  const out = { ...defaults };
  for (const k of Object.keys(defaults)) if (p.has(k)) out[k] = p.get(k);
  return out;
}

export function writeQuery(values, defaults) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== "" && v != null && v !== defaults[k]) p.set(k, v);
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Tautan internal bawaan situs (awalan situs ditambahkan di sini).
export function link(path, text, cls = LINK) {
  return h("a", { href: api.withBase(path), class: cls, text });
}

// Teks, atau tanda strip bila kosong.
export function orDash(text) { return text == null || text === "" ? "—" : text; }

// Kartu angka ringkas (KPI) untuk dasbor dan ringkasan.
export function stat(label, value, hint) {
  return h("div", { class: "card p-5" },
    h("p", { class: "text-sm text-muted-foreground-1", text: label }),
    h("p", { class: "mt-1 text-2xl font-semibold tracking-tight", text: String(value) }),
    hint ? h("p", { class: "mt-1 text-xs text-muted-foreground-1", text: hint }) : null);
}

// Pasangan label–isi untuk halaman detail. rows: [[label, isi], ...]; isi kosong tampil "—".
export function details(rows) {
  return h("dl", { class: "grid gap-x-6 gap-y-3 sm:grid-cols-2" },
    rows.map(([k, v]) => h("div", { class: "min-w-0" },
      h("dt", { class: "text-xs font-medium uppercase tracking-wide text-muted-foreground-1", text: k }),
      h("dd", { class: "mt-0.5 break-words text-sm" }, v == null || v === "" ? "—" : v))));
}

// Parameter ?id= halaman detail.
export function idParam() { return new URLSearchParams(location.search).get("id") || ""; }

// Isian formulir sebagai objek (nilai di-trim; kotak centang "1"/"0").
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.type === "file" || el.type === "submit" || el.type === "button") continue;
    if (el.type === "checkbox") out[el.name] = el.checked ? "1" : "0";
    else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  }
  return out;
}

// ── Formulir ──
// Kontrol bernama. opts.type: tipe <input> (bawaan "text"), "select", atau "textarea".
// opts.options: [[nilai, teks], ...] untuk select; opts.empty: teks pilihan kosong di depan.
export function control(name, opts = {}) {
  const { type = "text", value, required, options = [], empty, attrs = {} } = opts;
  let el;
  if (type === "select") {
    el = h("select", { class: "select", name, required: required || null, ...attrs },
      empty != null ? h("option", { value: "", text: empty }) : null,
      options.map(([v, t]) => h("option", { value: v, text: t })));
    if (value != null) el.value = String(value);
  } else if (type === "textarea") {
    el = h("textarea", { class: "textarea", name, rows: "3", required: required || null, ...attrs });
    if (value != null) el.value = String(value);
  } else {
    el = h("input", { class: type === "file" ? "input file:me-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5" : INPUT, type, name, required: required || null, ...attrs });
    if (value != null && type !== "file") el.value = String(value);
  }
  return el;
}

// Bidang lengkap (label + kontrol + petunjuk). Label diberi tanda * bila wajib.
export function fieldFor(name, label, opts = {}) {
  return field("f-" + name, opts.required ? label + " *" : label, control(name, opts), opts.hint);
}

// Formulir dengan kotak galat dan tombol kirim. onSubmit(form) dipanggil saat dikirim; galatnya tampil di
// kotak galat dan tombol aktif kembali. Mengembalikan elemen <form>.
export function formShell(children, submitLabel, onSubmit, { cancelHref } = {}) {
  const err = h("div", { role: "alert", class: "alert alert-error hidden" });
  const btn = h("button", { type: "submit", class: BTN_PRIMARY, text: submitLabel });
  const form = h("form", { class: "card card-pad space-y-5", novalidate: true },
    err, children,
    h("div", { class: "flex flex-wrap gap-2 pt-2" }, btn,
      cancelHref ? h("a", { href: api.withBase(cancelHref), class: "btn btn-outline", text: "Batal" }) : null));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError(err, "");
    setBusy(btn, true, "Menyimpan...");
    try {
      await onSubmit(form);
    } catch (ex) {
      showFormError(err, ex.message || "Terjadi kesalahan.");
    } finally {
      setBusy(btn, false);
    }
  });
  return form;
}

// Bagian bertajuk di dalam halaman detail.
export function section(title, ...children) {
  return h("section", { class: "card card-pad break-avoid min-w-0" },
    h("h2", { class: "text-lg font-semibold tracking-tight", text: title }),
    h("div", { class: "mt-4" }, children));
}
