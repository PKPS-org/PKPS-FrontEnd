import "../common.js";
import * as api from "../api.js";
import { h, mount, toast } from "../ui.js";
import { errorState, fieldFor, formShell, formValues, idParam, loadingState, startPage } from "../admin/kit.js";
import { SCHEDULE_STATUS, SCHEDULE_TYPE, options } from "../pkps.js";

// Satu modul untuk /schedules/new/ dan /schedules/edit/?id=. Kolom yang bisa diubah mengikuti API:
// judul, waktu, durasi, lokasi, status, dan catatan.
const state = document.getElementById("state");
const content = document.getElementById("content");
const editId = location.pathname.includes("/schedules/edit/") ? idParam() : "";

// "2026-10-21T08:30" (input datetime-local, waktu Jakarta) ↔ "2026-10-21 08:30:00" untuk API.
const toApi = (v) => (v ? v.replace("T", " ") + (v.length === 16 ? ":00" : "") : "");

if (await startPage("jadwal", ["admin", "pendamping"])) await load();
function toLocalInput(iso) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(iso)).reduce((o, p) => ((o[p.type] = p.value), o), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

async function load() {
  mount(state, loadingState());
  try {
    const [s, families] = await Promise.all([
      editId ? api.get(`/api/schedules/${encodeURIComponent(editId)}`).then((r) => r.data) : null,
      editId ? [] : api.get("/api/families?per_page=1000").then((r) => r.data),
    ]);
    mount(state);
    render(s, families);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function render(s, families) {
  const grid = (...c) => h("div", { class: "grid gap-4 sm:grid-cols-2" }, c);
  const children = s ? [
    fieldFor("title", "Judul", { value: s.title, required: true, attrs: { maxlength: "200" } }),
    grid(
      fieldFor("scheduled_at", "Waktu", { type: "datetime-local", value: toLocalInput(s.scheduled_at), required: true }),
      fieldFor("duration_minutes", "Durasi (menit)", { type: "number", value: s.duration_minutes, attrs: { min: "15" } }),
      fieldFor("location", "Lokasi", { value: s.location, attrs: { maxlength: "300" } }),
      fieldFor("status", "Status", { type: "select", options: options(SCHEDULE_STATUS), value: s.status })),
    fieldFor("notes", "Catatan", { type: "textarea", value: s.notes }),
  ] : [
    fieldFor("title", "Judul", { required: true, attrs: { maxlength: "200" } }),
    grid(
      fieldFor("type", "Jenis", { type: "select", options: options(SCHEDULE_TYPE), value: "kunjungan", required: true }),
      fieldFor("family_id", "Keluarga", { type: "select", empty: "— Tanpa keluarga —", options: families.map((f) => [f.id, `${f.head_name} (${f.family_code})`]) }),
      fieldFor("scheduled_at", "Waktu", { type: "datetime-local", required: true }),
      fieldFor("duration_minutes", "Durasi (menit)", { type: "number", value: 60, attrs: { min: "15", max: "480" } }),
      fieldFor("location", "Lokasi", { attrs: { maxlength: "300" } })),
    fieldFor("description", "Deskripsi", { type: "textarea" }),
    fieldFor("notes", "Catatan", { type: "textarea" }),
  ];
  if (s) document.getElementById("subtitle").textContent = s.title;
  mount(content, formShell(children, s ? "Simpan perubahan" : "Buat jadwal", async (form) => {
    const v = formValues(form);
    v.scheduled_at = toApi(v.scheduled_at);
    const body = {};
    for (const [k, val] of Object.entries(v)) if (val !== "" || (s && (k === "location" || k === "notes"))) body[k] = val === "" ? null : val;
    if (s) await api.put(`/api/schedules/${encodeURIComponent(s.id)}`, body);
    else await api.post("/api/schedules", body);
    toast(s ? "Jadwal berhasil diperbarui." : "Jadwal berhasil dibuat.");
    api.go("/schedules/");
  }, { cancelHref: "/schedules/" }));
}
