import "../common.js";
import * as api from "../api.js";
import { dateTimeID, h, icon, mount, toast } from "../ui.js";
import { emptyState, errorState, field, link, loadingState, orDash, readQuery, select, startPage, table, writeQuery } from "../admin/kit.js";
import { confirmDialog } from "../admin/dialog.js";
import { renderPager } from "../admin/pager.js";
import { SCHEDULE_STATUS, SCHEDULE_TYPE, label, options, scheduleBadge } from "../pkps.js";

const DEFAULTS = { scope: "upcoming", status: "", page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
let seq = 0;

if (await startPage("jadwal", ["admin", "pendamping"])) {
  mount(document.getElementById("actions"), h("a", { href: api.withBase("/schedules/new/"), class: "btn btn-primary" }, icon("plus"), "Jadwal baru"));
  const scope = select([["upcoming", "Mendatang"], ["past", "Sudah lewat"], ["all", "Semua"]], query.scope);
  const status = select([["", "Semua"], ...options(SCHEDULE_STATUS)], query.status);
  mount(document.getElementById("filters"), h("div", { class: "grid max-w-lg gap-3 sm:grid-cols-2" }, field("f-scope", "Waktu", scope), field("f-status", "Status", status)));
  scope.addEventListener("change", () => { query.scope = scope.value; query.page = "1"; load(); });
  status.addEventListener("change", () => { query.status = status.value; query.page = "1"; load(); });
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ per_page: "15", page: query.page });
  if (query.scope !== "all") p.set("scope", query.scope);
  if (query.status) p.set("status", query.status);
  try {
    const res = await api.get("/api/schedules?" + p);
    if (mine !== seq) return;
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function actions(s) {
  if (s.status === "cancelled" || s.status === "completed") return "";
  const cancel = h("button", { type: "button", class: "btn btn-danger btn-sm", text: "Batalkan" });
  cancel.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Batalkan jadwal?", message: `${s.title} · ${dateTimeID(s.scheduled_at)}. Keluarga yang dijadwalkan diberi tahu.`,
      confirmLabel: "Batalkan jadwal", danger: true, onConfirm: () => api.del(`/api/schedules/${encodeURIComponent(s.id)}`) });
    if (ok) { toast("Jadwal berhasil dibatalkan."); load(); }
  });
  return h("div", { class: "flex flex-wrap gap-2" },
    h("a", { href: api.withBase(`/schedules/edit/?id=${encodeURIComponent(s.id)}`), class: "btn btn-outline btn-sm", text: "Ubah" }), cancel);
}

function render(res) {
  if (!res.data.length) {
    mount(content, emptyState("Tidak ada jadwal.", "calendar"));
    mount(pager);
    return;
  }
  mount(content, table("Daftar jadwal", ["Kegiatan", "Waktu", "Keluarga", "Pendamping", "Status", ""],
    res.data.map((s) => [
      h("div", {}, h("div", { class: "font-medium", text: s.title }), h("div", { class: "text-xs text-muted-foreground-1", text: [label(SCHEDULE_TYPE, s.type), s.location].filter(Boolean).join(" · ") })),
      h("span", { class: "whitespace-nowrap", text: dateTimeID(s.scheduled_at) }),
      s.family ? link(`/families/detail/?id=${encodeURIComponent(s.family.id)}`, s.family.head_name) : "—",
      orDash(s.companion && s.companion.name), scheduleBadge(s.status), actions(s),
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
