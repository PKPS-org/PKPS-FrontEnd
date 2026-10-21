import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { badge, dateID, dateTimeID, h, icon, mount, rupiah, toast } from "../ui.js";
import { details, emptyState, errorState, fieldFor, formValues, idParam, link, loadingState, orDash, section, startPage, stat, table } from "../admin/kit.js";
import { confirmDialog, modal } from "../admin/dialog.js";
import {
  ACTIVITY_CATEGORY, GENDER, HOUSING, NEED_CATEGORY, NEED_PRIORITY, RELATIONSHIP, SCORE_DIMENSIONS,
  categoryBadge, label, needBadge, options, welfareBadge,
} from "../pkps.js";

const id = idParam();
const enc = encodeURIComponent(id);
const state = document.getElementById("state");
const content = document.getElementById("content");
const isAdmin = () => (session.getUser() || {}).role === "admin";
// Semua const yang dipakai fungsi di bawah harus dideklarasikan SEBELUM await tingkat modul.
const TX_TYPE = { income: "Pemasukan", expense: "Pengeluaran", saving_deposit: "Setor tabungan", saving_withdrawal: "Ambil tabungan" };
const LEVEL = { warning: "danger", info: "trial", good: "ok" };

if (await startPage("keluarga", ["admin", "pendamping"])) await load();

async function load() {
  mount(state, loadingState());
  try {
    const [family, needs, finance, txs, account, logs, acts] = await Promise.all([
      api.get(`/api/families/${enc}`).then((r) => r.data),
      api.get(`/api/families/${enc}/needs`).then((r) => r.data),
      api.get(`/api/families/${enc}/finance/summary`).then((r) => r.data),
      api.get(`/api/families/${enc}/finance/transactions?per_page=8`).then((r) => r.data),
      api.get(`/api/families/${enc}/account`).then((r) => r.data),
      api.get(`/api/families/${enc}/audit-logs?per_page=10`).then((r) => r.data),
      api.get(`/api/activities?family_id=${enc}&per_page=5`).then((r) => r.data),
    ]);
    mount(state);
    render(family, needs, finance, txs, account, logs, acts);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function render(f, needs, finance, txs, account, logs, acts) {
  document.getElementById("title").textContent = f.head_name;
  document.title = `${f.head_name} | PKPS`;
  document.getElementById("subtitle").textContent = `${f.family_code} · ${f.kelurahan}, ${f.kecamatan}, ${f.city}`;
  const del = isAdmin() ? h("button", { type: "button", class: "btn btn-danger" }, icon("trash"), "Hapus") : null;
  del?.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Hapus keluarga?", message: `Data keluarga ${f.head_name} disembunyikan dari semua daftar (hapus lunak).`, confirmLabel: "Hapus", danger: true,
      onConfirm: () => api.del(`/api/families/${enc}`) });
    if (ok) { toast("Data keluarga berhasil dihapus."); api.go("/families/"); }
  });
  mount(document.getElementById("actions"),
    h("a", { href: api.withBase(`/families/edit/?id=${enc}`), class: "btn btn-outline" }, icon("pencil"), "Ubah"),
    h("a", { href: api.withBase(`/assessments/new/?family=${enc}`), class: "btn btn-primary" }, icon("clipboard-list"), "Penilaian baru"),
    del);

  mount(content, h("div", { class: "space-y-6" },
    profile(f),
    h("div", { class: "grid grid-cols-1 gap-6 lg:grid-cols-2" }, members(f), assessment(f)),
    needsSection(needs),
    financeSection(finance, txs),
    h("div", { class: "grid grid-cols-1 gap-6 lg:grid-cols-2" }, accountSection(account), activitiesSection(acts)),
    auditSection(logs)));
}

function profile(f) {
  const photo = f.photo_url
    ? h("img", { src: f.photo_url, alt: `Foto keluarga ${f.head_name}`, class: "thumb max-w-xs" })
    : h("div", { class: "grid aspect-[4/3] w-full max-w-xs place-items-center rounded-xl border border-dashed border-line-3 text-muted-foreground-1" }, icon("image", "size-6"));
  return section("Profil keluarga", h("div", { class: "grid gap-6 md:grid-cols-[minmax(0,1fr)_2fr]" }, photo,
    details([
      ["Kode keluarga", f.family_code], ["NIK kepala keluarga", f.nik_head],
      ["Alamat", `${f.address}, RT/RW ${f.rt_rw}`], ["Wilayah", `${f.kelurahan}, ${f.kecamatan}, ${f.city}`],
      ["Status kesejahteraan", welfareBadge(f.welfare_status)], ["Tempat tinggal", label(HOUSING, f.housing_status)],
      ["Jumlah anggota", String(f.total_members)], ["Pendapatan bulanan", f.monthly_income == null ? "" : rupiah(f.monthly_income)],
      ["Pendamping", f.companion && f.companion.name], ["Terdaftar", dateID(f.registered_at)],
      ["Koordinat", f.lat != null && f.lng != null ? `${f.lat}, ${f.lng}` : ""], ["Catatan", f.notes],
    ])));
}

function members(f) {
  const add = h("button", { type: "button", class: "btn btn-outline btn-sm" }, icon("plus"), "Tambah anggota");
  add.addEventListener("click", async () => {
    const content = h("div", { class: "space-y-4" },
      fieldFor("name", "Nama", { required: true }),
      fieldFor("nik", "NIK", { required: true, attrs: { inputmode: "numeric", maxlength: "16" } }),
      fieldFor("gender", "Jenis kelamin", { type: "select", options: options(GENDER), required: true }),
      fieldFor("birth_date", "Tanggal lahir", { type: "date", required: true }),
      fieldFor("birth_place", "Tempat lahir"),
      fieldFor("relationship", "Hubungan", { type: "select", options: options(RELATIONSHIP), value: "child", required: true }),
      fieldFor("education", "Pendidikan"), fieldFor("occupation", "Pekerjaan"));
    const ok = await modal({ title: "Tambah anggota keluarga", content, confirmLabel: "Tambah",
      onSubmit: (form) => api.post(`/api/families/${enc}/members`, compact(formValues(form))) });
    if (ok) { toast("Anggota keluarga berhasil ditambahkan."); load(); }
  });
  const list = f.members || [];
  return section(`Anggota keluarga (${list.length})`,
    h("div", { class: "mb-3 print:hidden" }, add),
    list.length ? table("Anggota keluarga", ["Nama", "Hubungan", "Jenis kelamin", "Umur", "Pekerjaan"],
      list.map((m) => [h("div", {}, h("div", { class: "font-medium", text: m.name }), h("div", { class: "text-xs text-muted-foreground-1", text: m.nik })),
        label(RELATIONSHIP, m.relationship), label(GENDER, m.gender), m.age == null ? "—" : `${m.age} th`, orDash(m.occupation)]))
      : emptyState("Belum ada anggota keluarga tercatat.", "users"));
}

function assessment(f) {
  const a = f.latest_assessment;
  if (!a) return section("Penilaian terakhir", emptyState("Belum pernah dinilai.", "clipboard-list"));
  return section("Penilaian terakhir",
    h("div", { class: "flex flex-wrap items-center gap-3" },
      h("p", { class: "text-3xl font-semibold", text: `${a.total_score}/25` }), categoryBadge(a.category),
      h("span", { class: "text-sm text-muted-foreground-1", text: dateID(a.assessment_date) })),
    h("dl", { class: "mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-5" }, Object.entries(SCORE_DIMENSIONS).map(([k, l]) =>
      h("div", { class: "rounded-xl bg-muted p-2" }, h("dt", { class: "text-xs text-muted-foreground-1", text: l }), h("dd", { class: "text-lg font-semibold", text: String(a.scores[k]) })))),
    a.general_notes ? h("p", { class: "mt-3 text-sm", text: a.general_notes }) : null);
}

function needsSection(needs) {
  const actions = (n) => {
    if (n.status !== "pending") return "";
    const verify = h("button", { type: "button", class: "btn btn-outline btn-sm", text: "Verifikasi" });
    const reject = h("button", { type: "button", class: "btn btn-danger btn-sm", text: "Tolak" });
    verify.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Verifikasi kebutuhan?", message: n.title, confirmLabel: "Verifikasi",
        onConfirm: () => api.put(`/api/families/${enc}/needs/${encodeURIComponent(n.id)}`, { status: "verified" }) });
      if (ok) { toast("Status kebutuhan berhasil diperbarui."); load(); }
    });
    reject.addEventListener("click", async () => {
      const ok = await modal({ title: "Tolak kebutuhan", description: n.title, confirmLabel: "Tolak", danger: true,
        content: fieldFor("rejection_reason", "Alasan penolakan", { type: "textarea", required: true }),
        onSubmit: (form) => api.put(`/api/families/${enc}/needs/${encodeURIComponent(n.id)}`, { status: "rejected", rejection_reason: formValues(form).rejection_reason }) });
      if (ok) { toast("Status kebutuhan berhasil diperbarui."); load(); }
    });
    return h("div", { class: "flex flex-wrap gap-2 print:hidden" }, verify, reject);
  };
  return section("Kebutuhan", needs.length
    ? table("Kebutuhan keluarga", ["Kebutuhan", "Kategori", "Prioritas", "Perkiraan biaya", "Status", ""],
      needs.map((n) => [h("div", {}, h("div", { class: "font-medium", text: n.title }), n.description ? h("div", { class: "text-xs text-muted-foreground-1", text: n.description }) : null,
        n.rejection_reason ? h("div", { class: "text-xs text-red-700 dark:text-red-300", text: "Alasan: " + n.rejection_reason }) : null),
        label(NEED_CATEGORY, n.category), label(NEED_PRIORITY, n.priority), n.estimated_cost == null ? "—" : rupiah(n.estimated_cost), needBadge(n.status), actions(n)]))
    : emptyState("Belum ada kebutuhan yang diajukan.", "list-checks"));
}

function financeSection(s, txs) {
  const t = s.totals;
  return section(`Keuangan keluarga · ${s.month_label}`,
    h("div", { class: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" },
      stat("Pemasukan", rupiah(t.income)), stat("Pengeluaran", rupiah(t.expense)),
      stat("Ditabung", rupiah(t.savings)), stat("Sisa", rupiah(t.balance))),
    s.insights.length ? h("ul", { class: "mt-4 space-y-2" }, s.insights.map((i) => h("li", { class: "flex items-start gap-2 text-sm" }, badge(i.level === "warning" ? "Perhatian" : i.level === "good" ? "Baik" : "Info", LEVEL[i.level] || "neutral"), h("span", { text: i.message })))) : null,
    h("h3", { class: "mt-6 text-sm font-semibold", text: "8 catatan terakhir" }),
    h("div", { class: "mt-2" }, txs.length
      ? table("Catatan keuangan terakhir", ["Tanggal", "Jenis", "Kategori", "Jumlah", "Dicatat oleh"],
        txs.map((x) => [dateID(x.transaction_date), TX_TYPE[x.type] || x.type, x.category_label, rupiah(x.amount), orDash(x.recorded_by && x.recorded_by.name)]))
      : emptyState("Belum ada catatan keuangan.", "wallet")));
}

function accountSection(a) {
  const people = [
    a.owner ? [a.owner.name, a.owner.email, badge("Admin akun", "trial"), a.owner.is_active ? badge("Aktif", "ok") : badge("Nonaktif", "danger")] : null,
    ...a.collaborators.map((c) => c.user ? [c.user.name, c.user.email, badge(c.relation ? `Anggota (${c.relation})` : "Anggota"), c.user.is_active ? badge("Aktif", "ok") : badge("Nonaktif", "danger")] : null),
  ].filter(Boolean);
  return section("Akun keluarga",
    people.length ? table("Login akun keluarga", ["Nama", "Email", "Peran", "Status"], people) : emptyState("Belum ada login.", "user"),
    a.invitations && a.invitations.length ? h("p", { class: "mt-3 text-sm text-muted-foreground-1",
      text: `Kode undangan aktif: ${a.invitations.map((i) => `${i.code} (s.d. ${dateID(i.expires_at)})`).join(", ")}` }) : null);
}

function activitiesSection(rows) {
  return section("Aktivitas terakhir", rows.length
    ? h("ul", { class: "divide-y divide-line-2" }, rows.map((x) => h("li", { class: "py-3" },
      link(`/activities/edit/?id=${encodeURIComponent(x.id)}`, x.title),
      h("p", { class: "text-sm text-muted-foreground-1", text: `${dateID(x.activity_date)} · ${label(ACTIVITY_CATEGORY, x.category)}${x.companion ? " · " + x.companion.name : ""}` }))))
    : emptyState("Belum ada aktivitas untuk keluarga ini.", "activity"));
}

function auditSection(logs) {
  return section("Riwayat Perubahan", logs.length
    ? h("ul", { class: "divide-y divide-line-2" }, logs.map((l) => h("li", { class: "py-3 text-sm" },
      h("p", {}, h("span", { class: "font-medium", text: l.user ? l.user.name : "Sistem" }), ` ${l.action_label} · `, h("span", { class: "text-muted-foreground-1", text: l.subject_label })),
      h("p", { class: "mt-0.5", text: l.description }),
      l.changes.length ? h("ul", { class: "mt-1 space-y-0.5 text-xs text-muted-foreground-1" }, l.changes.map((c) => h("li", { text: `${c.label}: ${c.old} → ${c.new}` }))) : null,
      h("p", { class: "mt-0.5 text-xs text-muted-foreground-1", text: dateTimeID(l.created_at) }))))
    : emptyState("Belum ada perubahan tercatat.", "rotate-ccw"));
}

function compact(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (v !== "") out[k] = v;
  return out;
}
