import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { h, mount, toast, todayISO } from "../ui.js";
import { confirmDialog } from "../admin/dialog.js";
import { errorState, fieldFor, formShell, formValues, idParam, loadingState, startPage } from "../admin/kit.js";
import { ACTIVITY_CATEGORY, options } from "../pkps.js";

// Satu modul untuk /activities/new/ dan /activities/edit/?id=. Foto yang dipilih saat mengubah
// menggantikan semua foto lama.
const state = document.getElementById("state");
const content = document.getElementById("content");
const editId = location.pathname.includes("/activities/edit/") ? idParam() : "";

if (await startPage("aktivitas", ["admin", "pendamping"])) await load();

async function load() {
  mount(state, loadingState());
  try {
    const [a, families, schedules] = await Promise.all([
      editId ? api.get(`/api/activities/${encodeURIComponent(editId)}`).then((r) => r.data) : null,
      api.get("/api/families?per_page=1000").then((r) => r.data),
      api.get("/api/schedules?per_page=100&scope=past").then((r) => r.data),
    ]);
    mount(state);
    render(a, families, schedules);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function render(a, families, schedules) {
  const v = (k) => (a ? a[k] : undefined);
  const me = session.getUser() || {};
  const canChange = !a || me.role === "admin" || a.companion_id === me.id;
  const grid = (...c) => h("div", { class: "grid gap-4 sm:grid-cols-2" }, c);
  const gallery = a && a.photos.length ? h("div", { class: "grid grid-cols-2 gap-3 sm:grid-cols-3" },
    a.photos.map((src, i) => h("img", { src, alt: `Foto ${i + 1} aktivitas ${a.title}`, class: "thumb" }))) : null;
  const children = [
    fieldFor("title", "Judul", { value: v("title"), required: true, attrs: { maxlength: "200" } }),
    grid(
      fieldFor("category", "Kategori", { type: "select", options: options(ACTIVITY_CATEGORY), value: v("category") ?? "kunjungan", required: true }),
      fieldFor("activity_date", "Tanggal", { type: "date", value: v("activity_date") ?? todayISO(), required: true, attrs: { max: todayISO() } }),
      fieldFor("family_id", "Keluarga", { type: "select", empty: "— Tanpa keluarga —", options: families.map((f) => [f.id, `${f.head_name} (${f.family_code})`]), value: v("family_id") ?? "" }),
      fieldFor("schedule_id", "Jadwal terkait", { type: "select", empty: "— Tanpa jadwal —", options: schedules.map((s) => [s.id, s.title]), value: v("schedule_id") ?? "" }),
      fieldFor("duration_minutes", "Durasi (menit)", { type: "number", value: v("duration_minutes"), attrs: { min: "15" } }),
      fieldFor("participants_count", "Jumlah peserta", { type: "number", value: v("participants_count") ?? 1, attrs: { min: "1" } })),
    fieldFor("description", "Deskripsi", { type: "textarea", value: v("description"), required: true }),
    fieldFor("outcome", "Hasil", { type: "textarea", value: v("outcome") }),
    fieldFor("follow_up", "Tindak lanjut", { type: "textarea", value: v("follow_up") }),
    gallery,
    fieldFor("photos", a ? "Ganti foto dokumentasi" : "Foto dokumentasi", { type: "file", attrs: { accept: "image/jpeg,image/png,image/webp", multiple: true },
      hint: a ? "Foto yang dipilih menggantikan semua foto di atas. Maks. 5 MB per foto." : "Boleh lebih dari satu. Maks. 5 MB per foto (dikecilkan otomatis)." }),
  ];
  if (a) document.getElementById("subtitle").textContent = a.companion ? `Dicatat oleh ${a.companion.name}` : "";
  if (a && canChange) {
    const del = h("button", { type: "button", class: "btn btn-danger", text: "Hapus" });
    del.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Hapus aktivitas?", message: a.title, confirmLabel: "Hapus", danger: true,
        onConfirm: () => api.del(`/api/activities/${encodeURIComponent(a.id)}`) });
      if (ok) { toast("Aktivitas berhasil dihapus."); api.go("/activities/"); }
    });
    mount(document.getElementById("actions"), del);
  }
  if (!canChange) {
    mount(content, h("div", { class: "space-y-4" }, h("p", { class: "alert alert-info", text: "Aktivitas ini dicatat pendamping lain; hanya pencatatnya atau admin yang dapat mengubahnya." }),
      h("div", { class: "card card-pad space-y-4" }, h("p", { class: "font-medium", text: a.title }), h("p", { class: "text-sm", text: a.description }), gallery)));
    return;
  }
  mount(content, formShell(children, a ? "Simpan perubahan" : "Simpan aktivitas", async (form) => {
    const values = formValues(form);
    const fields = {};
    for (const [k, val] of Object.entries(values)) if (val !== "") fields[k] = val;
    const files = [...form.querySelector('input[name="photos"]').files];
    const fd = await api.formData(fields, files.length ? { photos: files } : {});
    if (a) for (const k of ["family_id", "schedule_id", "duration_minutes", "outcome", "follow_up"]) if (values[k] === "") fd.set(k, "");
    if (a) await api.put(`/api/activities/${encodeURIComponent(a.id)}`, fd);
    else await api.post("/api/activities", fd);
    toast(a ? "Aktivitas berhasil diperbarui." : "Aktivitas berhasil dicatat.");
    api.go("/activities/");
  }, { cancelHref: "/activities/" }));
}
