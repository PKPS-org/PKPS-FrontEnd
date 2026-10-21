import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { copyText, h, icon, mount, toast, todayISO } from "../ui.js";
import { errorState, fieldFor, formShell, formValues, idParam, loadingState, startPage } from "../admin/kit.js";
import { HOUSING, WELFARE, options } from "../pkps.js";

// Satu modul untuk /families/new/ dan /families/edit/?id=.
const state = document.getElementById("state");
const content = document.getElementById("content");
const editId = location.pathname.includes("/families/edit/") ? idParam() : "";

if (await startPage("keluarga", ["admin", "pendamping"])) await load();

async function load() {
  mount(state, loadingState());
  try {
    const isAdmin = (session.getUser() || {}).role === "admin";
    const [family, companions] = await Promise.all([
      editId ? api.get(`/api/families/${encodeURIComponent(editId)}`).then((r) => r.data) : null,
      isAdmin ? api.get("/api/users?role=pendamping").then((r) => r.data) : [],
    ]);
    mount(state);
    render(family, isAdmin ? companions : null);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function render(f, companions) {
  const v = (k) => (f ? f[k] : undefined);
  const grid = (...c) => h("div", { class: "grid gap-4 sm:grid-cols-2" }, c);
  const photo = fieldFor("photo", "Foto keluarga", { type: "file", attrs: { accept: "image/jpeg,image/png,image/webp" }, hint: "Gambar, maks. 2 MB (dikecilkan otomatis)." });
  const children = [
    grid(
      fieldFor("head_name", "Nama kepala keluarga", { value: v("head_name"), required: true, attrs: { maxlength: "100" } }),
      fieldFor("nik_head", "NIK kepala keluarga", { value: v("nik_head"), required: true, attrs: { inputmode: "numeric", maxlength: "16", pattern: "[0-9]{16}" }, hint: "16 digit." })),
    fieldFor("address", "Alamat", { type: "textarea", value: v("address"), required: true }),
    grid(
      fieldFor("rt_rw", "RT/RW", { value: v("rt_rw"), required: true, attrs: { maxlength: "10" } }),
      fieldFor("kelurahan", "Kelurahan", { value: v("kelurahan"), required: true }),
      fieldFor("kecamatan", "Kecamatan", { value: v("kecamatan"), required: true }),
      fieldFor("city", "Kota/Kabupaten", { value: v("city"), required: true })),
    grid(
      fieldFor("lat", "Lintang (lat)", { type: "number", value: v("lat"), attrs: { step: "any", min: "-90", max: "90" } }),
      fieldFor("lng", "Bujur (lng)", { type: "number", value: v("lng"), attrs: { step: "any", min: "-180", max: "180" } })),
    grid(
      fieldFor("total_members", "Jumlah anggota", { type: "number", value: v("total_members") ?? 1, required: true, attrs: { min: "1", max: "20" } }),
      fieldFor("monthly_income", "Pendapatan bulanan (Rp)", { type: "number", value: v("monthly_income"), attrs: { min: "0", step: "1000" } }),
      fieldFor("housing_status", "Status tempat tinggal", { type: "select", options: options(HOUSING), value: v("housing_status") ?? "rent", required: true }),
      fieldFor("welfare_status", "Status kesejahteraan", { type: "select", options: options(WELFARE), value: v("welfare_status") ?? "pra_sejahtera", required: true }),
      fieldFor("registered_at", "Tanggal terdaftar", { type: "date", value: v("registered_at") ?? todayISO(), required: true })),
    companions ? fieldFor("companion_id", "Pendamping", { type: "select", empty: "— Belum ditentukan —",
      options: companions.map((c) => [c.id, c.name]), value: f && f.companion ? f.companion.id : "" }) : null,
    photo,
    fieldFor("notes", "Catatan", { type: "textarea", value: v("notes") }),
  ];
  const form = formShell(children, f ? "Simpan perubahan" : "Daftarkan keluarga", async (formEl) => {
    const values = formValues(formEl);
    // Kolom kosong tidak dikirim saat membuat; saat mengubah, kolom opsional yang dikosongkan dikirim kosong (null).
    const fields = {};
    for (const [k, val] of Object.entries(values)) if (val !== "" || f) fields[k] = val;
    const file = formEl.querySelector('input[name="photo"]').files[0];
    const fd = await api.formData(fields, file ? { photo: file } : {});
    if (f) for (const [k, val] of Object.entries(fields)) if (val === "") fd.set(k, "");
    if (f) {
      await api.put(`/api/families/${encodeURIComponent(f.id)}`, fd);
      toast("Data keluarga berhasil diperbarui.");
      api.go(`/families/detail/?id=${encodeURIComponent(f.id)}`);
      return;
    }
    const res = await api.post("/api/families", fd);
    showAccount(res);
  }, { cancelHref: f ? `/families/detail/?id=${encodeURIComponent(f.id)}` : "/families/" });
  if (f) document.getElementById("subtitle").textContent = `${f.head_name} · ${f.family_code}`;
  mount(content, form);
}

// Setelah keluarga dibuat: tampilkan kredensial akun aplikasi keluarga untuk diserahkan pendamping.
function showAccount(res) {
  const acc = res.account || {};
  const copyBtn = (text, lbl) => {
    const b = h("button", { type: "button", class: "btn btn-outline btn-sm" }, icon("copy"), lbl);
    b.addEventListener("click", async () => toast((await copyText(text)) ? "Disalin." : "Gagal menyalin.", "info"));
    return b;
  };
  mount(content, h("div", { id: "account", class: "card card-pad space-y-4" },
    h("div", { role: "status", class: "alert alert-success", text: res.message }),
    h("h2", { class: "text-lg font-semibold", text: "Akun aplikasi Keluarga Mandiri" }),
    h("p", { class: "text-sm text-muted-foreground-1", text: "Serahkan email dan sandi awal ini kepada keluarga. Sandi awal tidak bisa ditampilkan lagi." }),
    h("dl", { class: "grid gap-3 sm:grid-cols-2" },
      h("div", {}, h("dt", { class: "label", text: "Email" }), h("dd", { class: "flex flex-wrap items-center gap-2" }, h("code", { id: "account-email", class: "rounded bg-muted px-2 py-1", text: acc.email }), copyBtn(acc.email, "Salin"))),
      h("div", {}, h("dt", { class: "label", text: "Sandi awal" }), h("dd", { class: "flex flex-wrap items-center gap-2" }, h("code", { id: "account-password", class: "rounded bg-muted px-2 py-1", text: acc.initial_password }), copyBtn(acc.initial_password, "Salin")))),
    h("div", { class: "flex flex-wrap gap-2" },
      h("a", { href: api.withBase(`/families/detail/?id=${encodeURIComponent(res.data.id)}`), class: "btn btn-primary", text: "Lihat detail keluarga" }),
      h("a", { href: api.withBase("/families/new/"), class: "btn btn-outline", text: "Tambah keluarga lain" }))));
}
