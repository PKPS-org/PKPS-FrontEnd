import "../common.js";
import * as api from "../api.js";
import { h, icon, mount, rupiah, toast, todayISO } from "../ui.js";
import { INPUT, avatar, debounce, emptyState, errorState, field, link, loadingState, orDash, readQuery, select, startPage, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";
import { WELFARE, options, welfareBadge } from "../pkps.js";

// Semua const yang dipakai fungsi di bawah dideklarasikan SEBELUM await tingkat modul.
const DEFAULTS = { search: "", welfare_status: "", city: "", page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
let seq = 0;

if (await startPage("keluarga", ["admin", "pendamping"])) {
  const exportBtn = h("button", { type: "button", class: "btn btn-outline" }, icon("file-spreadsheet"), "Ekspor Excel");
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    try {
      await api.download("/api/families/export", `Data_Keluarga_PKPS_${todayISO()}.xlsx`);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      exportBtn.disabled = false;
    }
  });
  mount(document.getElementById("actions"), exportBtn,
    h("a", { href: api.withBase("/families/new/"), class: "btn btn-primary" }, icon("plus"), "Tambah keluarga"));

  const q = h("input", { type: "search", class: INPUT, value: query.search, autocomplete: "off", placeholder: "Nama, kode, atau awal NIK" });
  const welfare = select([["", "Semua"], ...options(WELFARE)], query.welfare_status);
  const city = h("input", { type: "search", class: INPUT, value: query.city, autocomplete: "off", placeholder: "Kota" });
  mount(document.getElementById("filters"),
    h("form", { role: "search", class: "grid gap-3 sm:grid-cols-3", on: { submit: (e) => e.preventDefault() } },
      field("f-search", "Cari", q), field("f-welfare", "Status kesejahteraan", welfare), field("f-city", "Kota", city)));
  const reload = () => { query.page = "1"; load(); };
  q.addEventListener("input", debounce(() => { query.search = q.value.trim(); reload(); }));
  city.addEventListener("input", debounce(() => { query.city = city.value.trim(); reload(); }));
  welfare.addEventListener("change", () => { query.welfare_status = welfare.value; reload(); });
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ per_page: "15", page: query.page });
  for (const k of ["search", "welfare_status", "city"]) if (query[k]) p.set(k, query[k]);
  try {
    const res = await api.get("/api/families?" + p);
    if (mine !== seq) return; // jawaban usang: permintaan yang lebih baru sudah berjalan
    if (res.meta.current_page > res.meta.last_page) {
      query.page = String(res.meta.last_page);
      return load();
    }
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function render(res) {
  if (!res.data.length) {
    mount(content, emptyState("Tidak ada keluarga yang cocok."));
    mount(pager);
    return;
  }
  mount(content, table("Daftar keluarga", ["Kepala keluarga", "Alamat", "Status", "Pendapatan", "Pendamping", "Penilaian terakhir"],
    res.data.map((f) => [
      h("div", { class: "flex items-center gap-3" }, avatar(f.head_name),
        h("div", { class: "min-w-0" }, link(`/families/detail/?id=${encodeURIComponent(f.id)}`, f.head_name),
          h("div", { class: "text-xs text-muted-foreground-1", text: `${f.family_code} · ${f.total_members} anggota` }))),
      h("div", { class: "min-w-40" }, h("div", { text: f.address }), h("div", { class: "text-xs text-muted-foreground-1", text: [f.kelurahan, f.kecamatan, f.city].join(", ") })),
      welfareBadge(f.welfare_status),
      f.monthly_income == null ? "—" : h("span", { class: "whitespace-nowrap", text: rupiah(f.monthly_income) }),
      orDash(f.companion && f.companion.name),
      f.latest_assessment ? h("span", { class: "whitespace-nowrap", text: `${f.latest_assessment.total_score}/25` }) : "—",
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
