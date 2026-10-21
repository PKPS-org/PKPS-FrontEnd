import "../common.js";
import * as api from "../api.js";
import { dateID, h, icon, mount } from "../ui.js";
import { INPUT, avatar, debounce, emptyState, errorState, field, link, loadingState, readQuery, startPage, stat, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";
import { categoryBadge, welfareBadge } from "../pkps.js";

const DEFAULTS = { search: "", page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
let seq = 0;

if (await startPage("penilaian", ["admin", "pendamping"])) {
  const q = h("input", { type: "search", class: INPUT, value: query.search, autocomplete: "off", placeholder: "Nama kepala keluarga" });
  mount(document.getElementById("filters"),
    h("form", { role: "search", class: "max-w-sm", on: { submit: (e) => e.preventDefault() } }, field("f-search", "Cari", q)));
  q.addEventListener("input", debounce(() => { query.search = q.value.trim(); query.page = "1"; load(); }));
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ page: query.page });
  if (query.search) p.set("search", query.search);
  try {
    const res = await api.get("/api/assessments?" + p);
    if (mine !== seq) return;
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function render(res) {
  const imp = res.improvement;
  const stats = h("div", { class: "mb-6 grid gap-4 sm:grid-cols-3" }, stat("Membaik", imp.improving), stat("Menurun", imp.declining), stat("Tetap", imp.stable));
  if (!res.data.length) {
    mount(content, stats, emptyState("Tidak ada keluarga yang cocok."));
    mount(pager);
    return;
  }
  mount(content, stats, table("Penilaian per keluarga", ["Keluarga", "Status", "Penilaian terakhir", "Jumlah penilaian", ""],
    res.data.map((f) => {
      const a = f.latest_assessment;
      return [
        h("div", { class: "flex items-center gap-3" }, avatar(f.head_name),
          h("div", { class: "min-w-0" }, link(`/families/detail/?id=${encodeURIComponent(f.id)}`, f.head_name), h("div", { class: "text-xs text-muted-foreground-1", text: f.family_code }))),
        welfareBadge(f.welfare_status),
        a ? h("div", { class: "space-y-1" }, h("div", { class: "flex items-center gap-2" }, h("span", { class: "font-semibold", text: `${a.total_score}/25` }), categoryBadge(a.category)),
          h("div", { class: "text-xs text-muted-foreground-1", text: dateID(a.assessment_date) })) : "Belum dinilai",
        String(f.assessments_count),
        h("a", { href: api.withBase(`/assessments/new/?family=${encodeURIComponent(f.id)}`), class: "btn btn-outline btn-sm" }, icon("plus"), "Nilai"),
      ];
    })));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
