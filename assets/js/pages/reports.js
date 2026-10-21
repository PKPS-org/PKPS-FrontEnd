import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { dateID, dateTimeID, h, mount, toast } from "../ui.js";
import { emptyState, errorState, fieldFor, formShell, formValues, link, loadingState, orDash, readQuery, section, startPage, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";
import { REPORT_TYPE, label, options } from "../pkps.js";

const DEFAULTS = { page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
const list = document.createElement("div");
let seq = 0;

if (await startPage("laporan")) {
  const isAdmin = (session.getUser() || {}).role === "admin";
  mount(content, h("div", { class: "space-y-6" }, isAdmin ? generator() : null, list));
  await load();
}

// Formulir pembuatan laporan: hanya admin.
function generator() {
  const first = new Date();
  first.setDate(1);
  const iso = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
  return section("Buat laporan", formShell([
    h("div", { class: "grid gap-4 sm:grid-cols-3" },
      fieldFor("type", "Jenis laporan", { type: "select", options: options(REPORT_TYPE), value: "bulanan", required: true }),
      fieldFor("period_start", "Awal periode", { type: "date", value: iso(first), required: true }),
      fieldFor("period_end", "Akhir periode", { type: "date", value: iso(new Date()), required: true })),
    fieldFor("notes", "Catatan", { type: "textarea", attrs: { rows: "2" } }),
  ], "Buat laporan", async (form) => {
    const v = formValues(form);
    if (!v.notes) delete v.notes;
    const res = await api.post("/api/reports/generate", v);
    toast(res.message);
    api.go(`/reports/detail/?id=${encodeURIComponent(res.data.id)}`);
  }));
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  try {
    const res = await api.get("/api/reports?page=" + encodeURIComponent(query.page));
    if (mine !== seq) return;
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function render(res) {
  if (!res.data.length) {
    mount(list, emptyState("Belum ada laporan.", "file-text"));
    mount(pager);
    return;
  }
  mount(list, table("Daftar laporan", ["Laporan", "Jenis", "Periode", "Dibuat oleh", "Dibuat"],
    res.data.map((r) => [
      h("div", {}, link(`/reports/detail/?id=${encodeURIComponent(r.id)}`, r.title), h("div", { class: "text-xs text-muted-foreground-1", text: r.report_code })),
      label(REPORT_TYPE, r.type), h("span", { class: "whitespace-nowrap", text: `${dateID(r.period_start)} – ${dateID(r.period_end)}` }),
      orDash(r.generator && r.generator.name), h("span", { class: "whitespace-nowrap", text: dateTimeID(r.created_at) }),
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
