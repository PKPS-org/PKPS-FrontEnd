import "../common.js";
import * as api from "../api.js";
import { dateID, h, icon, mount } from "../ui.js";
import { emptyState, errorState, field, link, loadingState, orDash, readQuery, select, startPage, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";
import { ACTIVITY_CATEGORY, label, options } from "../pkps.js";

const DEFAULTS = { category: "", page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
let seq = 0;

if (await startPage("aktivitas", ["admin", "pendamping"])) {
  mount(document.getElementById("actions"), h("a", { href: api.withBase("/activities/new/"), class: "btn btn-primary" }, icon("plus"), "Aktivitas baru"));
  const cat = select([["", "Semua"], ...options(ACTIVITY_CATEGORY)], query.category);
  mount(document.getElementById("filters"), h("div", { class: "max-w-xs" }, field("f-category", "Kategori", cat)));
  cat.addEventListener("change", () => { query.category = cat.value; query.page = "1"; load(); });
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ per_page: "15", page: query.page });
  if (query.category) p.set("category", query.category);
  try {
    const res = await api.get("/api/activities?" + p);
    if (mine !== seq) return;
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function render(res) {
  if (!res.data.length) {
    mount(content, emptyState("Belum ada aktivitas.", "activity"));
    mount(pager);
    return;
  }
  mount(content, table("Daftar aktivitas", ["Aktivitas", "Tanggal", "Keluarga", "Pendamping", "Foto"],
    res.data.map((a) => [
      h("div", {}, link(`/activities/edit/?id=${encodeURIComponent(a.id)}`, a.title), h("div", { class: "text-xs text-muted-foreground-1", text: label(ACTIVITY_CATEGORY, a.category) })),
      h("span", { class: "whitespace-nowrap", text: dateID(a.activity_date) }),
      orDash(a.family && a.family.head_name), orDash(a.companion && a.companion.name),
      a.photos.length ? h("img", { src: a.photos[0], alt: `Foto aktivitas ${a.title}`, class: "h-12 w-16 rounded-lg object-cover" }) : "—",
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
