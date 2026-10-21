import "../common.js";
import * as api from "../api.js";
import { badge, dateTimeID, h, icon, mount, toast } from "../ui.js";
import { emptyState, errorState, fieldFor, formValues, loadingState, orDash, startPage, table } from "../admin/kit.js";
import { confirmDialog, modal } from "../admin/dialog.js";

// Kelola akun pendamping (khusus admin). Akun tidak dihapus karena keluarga, penilaian, dan aktivitas
// menautkannya; pendamping yang berhenti dinonaktifkan.
const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startPage("pendamping", ["admin"])) {
  const add = h("button", { type: "button", class: "btn btn-primary" }, icon("plus"), "Tambah pendamping");
  add.addEventListener("click", create);
  mount(document.getElementById("actions"), add);
  await load();
}

async function load() {
  mount(state, loadingState());
  try {
    const res = await api.get("/api/pendampings");
    mount(state);
    render(res.data);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

const PASSWORD_HINT = "Minimal 8 karakter. Sampaikan ke pendamping secara langsung.";
const passwordFields = (required) => [
  fieldFor("password", "Kata sandi", { type: "password", required, hint: PASSWORD_HINT, attrs: { autocomplete: "new-password", minlength: "8", maxlength: "72" } }),
  fieldFor("password_confirmation", "Ulangi kata sandi", { type: "password", required, attrs: { autocomplete: "new-password" } }),
];
const profileFields = (p = {}) => [
  fieldFor("name", "Nama", { required: true, value: p.name, attrs: { maxlength: "100", autocomplete: "off" } }),
  fieldFor("email", "Email (untuk login)", { type: "email", required: true, value: p.email, attrs: { autocomplete: "off" } }),
  fieldFor("phone", "Nomor HP", { type: "tel", value: p.phone, attrs: { inputmode: "tel", maxlength: "20" } }),
];

async function create() {
  const ok = await modal({ title: "Tambah pendamping", confirmLabel: "Tambah",
    content: h("div", { class: "space-y-4" }, profileFields(), passwordFields(true)),
    onSubmit: (form) => api.post("/api/pendampings", formValues(form)) });
  if (ok) { toast("Pendamping berhasil ditambahkan."); load(); }
}

async function edit(p) {
  const ok = await modal({ title: "Ubah data pendamping", description: p.name, content: h("div", { class: "space-y-4" }, profileFields(p)),
    onSubmit: (form) => api.put(`/api/pendampings/${encodeURIComponent(p.id)}`, formValues(form)) });
  if (ok) { toast("Data pendamping berhasil diperbarui."); load(); }
}

async function resetPassword(p) {
  const ok = await modal({ title: "Atur ulang kata sandi", description: `${p.name} akan keluar dari semua perangkat dan harus login dengan sandi baru.`,
    content: h("div", { class: "space-y-4" }, passwordFields(true)),
    onSubmit: (form) => api.put(`/api/pendampings/${encodeURIComponent(p.id)}`, formValues(form)) });
  if (ok) toast("Kata sandi berhasil diatur ulang.");
}

async function toggleActive(p) {
  const off = p.is_active;
  const message = off
    ? `${p.name} tidak bisa login lagi dan keluar dari semua perangkat. Data keluarga dampingannya tetap tersimpan${p.families_count ? ` (${p.families_count} keluarga; pindahkan pendampingnya lewat Data Keluarga)` : ""}.`
    : `${p.name} bisa login kembali.`;
  const ok = await confirmDialog({ title: off ? "Nonaktifkan pendamping?" : "Aktifkan pendamping?", message,
    confirmLabel: off ? "Nonaktifkan" : "Aktifkan", danger: off,
    onConfirm: () => api.put(`/api/pendampings/${encodeURIComponent(p.id)}`, { is_active: !off }) });
  if (ok) { toast(off ? "Pendamping dinonaktifkan." : "Pendamping diaktifkan kembali."); load(); }
}

function actions(p) {
  const btn = (text, ico, fn, cls = "btn btn-outline btn-sm") => {
    const b = h("button", { type: "button", class: cls, "aria-label": `${text} ${p.name}` }, icon(ico), text);
    b.addEventListener("click", () => fn(p));
    return b;
  };
  return h("div", { class: "flex flex-wrap gap-2" },
    btn("Ubah", "pencil", edit), btn("Sandi", "key", resetPassword),
    p.is_active ? btn("Nonaktifkan", "x-circle", toggleActive, "btn btn-danger btn-sm") : btn("Aktifkan", "check-circle", toggleActive));
}

function render(rows) {
  if (!rows.length) {
    mount(content, emptyState("Belum ada pendamping. Tambahkan lewat tombol di atas.", "users"));
    return;
  }
  mount(content, table("Daftar pendamping", ["Pendamping", "Nomor HP", "Keluarga", "Terakhir aktif", "Status", "Aksi"],
    rows.map((p) => [
      h("div", { class: "min-w-0" }, h("div", { class: "font-medium", text: p.name }), h("div", { class: "break-all text-xs text-muted-foreground-1", text: p.email })),
      orDash(p.phone), String(p.families_count),
      p.last_seen_at ? h("span", { class: "whitespace-nowrap", text: dateTimeID(p.last_seen_at) }) : "Belum pernah",
      p.is_active ? badge("Aktif", "ok") : badge("Nonaktif", "neutral"),
      actions(p),
    ])));
}
