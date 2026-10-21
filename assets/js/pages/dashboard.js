import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { badge, dateTimeID, h, icon, mount, rupiah } from "../ui.js";
import { emptyState, errorState, link, loadingState, section, startPage, stat, table } from "../admin/kit.js";
import { makeChart } from "../admin/charts.js";
import { WELFARE, label, SCHEDULE_TYPE } from "../pkps.js";

const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startPage("dasbor")) await load();

async function load() {
  mount(state, loadingState());
  const role = (session.getUser() || {}).role;
  const staff = role === "admin" || role === "pendamping";
  try {
    if (staff) {
      const [dash, monthly, follow, map] = await Promise.all([
        api.get("/api/dashboard"), api.get("/api/dashboard/monthly-donations"),
        api.get("/api/dashboard/follow-up"), api.get("/api/dashboard/map"),
      ]);
      mount(state);
      renderStaff(dash.data, monthly.data, follow.data, map.data);
    } else {
      const [summary, map] = await Promise.all([api.get("/api/dashboard/summary"), api.get("/api/dashboard/map")]);
      mount(state);
      renderDonor(summary.data, map.data);
    }
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function kpis(families, finance, extra = []) {
  return h("div", { class: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4" },
    stat("Keluarga binaan", families.total, `${families.total_members} anggota aktif`),
    stat("Donasi masuk bulan ini", rupiah(finance.total_donations_in), `${finance.pending_donations} donasi menunggu konfirmasi`),
    stat("Tersalurkan bulan ini", rupiah(finance.total_disbursed)),
    stat("Saldo bulan ini", rupiah(finance.balance)),
    extra);
}

// Distribusi kesejahteraan: diagram donat plus tabel angka (diagram saja tidak terbaca pembaca layar).
function welfareSection(families) {
  const keys = ["pra_sejahtera", "sejahtera_1", "sejahtera_2"];
  const canvas = h("canvas", { role: "img", "aria-label": "Diagram distribusi status kesejahteraan keluarga" });
  const wrap = h("div", { class: "relative h-56" }, canvas);
  const body = h("div", { class: "grid items-center gap-6 md:grid-cols-2" }, wrap,
    table("Distribusi status kesejahteraan", ["Status", "Keluarga"], keys.map((k) => [h("span", { class: "whitespace-nowrap", text: label(WELFARE, k) }), String(families[k] || 0)])));
  const sec = section("Distribusi kesejahteraan", body);
  queueMicrotask(() => makeChart(canvas, (t) => ({
    type: "doughnut",
    data: { labels: keys.map((k) => label(WELFARE, k)), datasets: [{ data: keys.map((k) => families[k] || 0), backgroundColor: [t.c.accent, t.c.light, t.c.strong], borderWidth: 0 }] },
    options: { plugins: { legend: { position: "bottom" } } },
  })));
  return sec;
}

function monthlySection(rows) {
  const canvas = h("canvas", { role: "img", "aria-label": "Grafik donasi masuk dan penyaluran enam bulan terakhir" });
  const sec = section("Donasi dan penyaluran 6 bulan terakhir",
    h("div", { class: "relative h-64" }, canvas),
    h("details", { class: "mt-4 text-sm" }, h("summary", { class: "cursor-pointer text-muted-foreground-1", text: "Lihat angka" }),
      h("div", { class: "mt-3" }, table("Donasi dan penyaluran per bulan", ["Bulan", "Donasi masuk", "Disalurkan"],
        rows.map((r) => [r.month, rupiah(r.donations_in), rupiah(r.disbursed)])))));
  queueMicrotask(() => makeChart(canvas, (t) => ({
    type: "bar",
    data: {
      labels: rows.map((r) => r.month),
      datasets: [
        { label: "Donasi masuk", data: rows.map((r) => r.donations_in), backgroundColor: t.c.primary },
        { label: "Disalurkan", data: rows.map((r) => r.disbursed), backgroundColor: t.c.accent },
      ],
    },
    options: { plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true, suggestedMax: 1000000, ticks: { precision: 0, callback: (v) => rupiah(v) } } } },
  })));
  return sec;
}

function improvementSection(t) {
  return section("Perkembangan penilaian",
    h("div", { class: "grid gap-4 sm:grid-cols-3" },
      stat("Membaik", t.improving), stat("Menurun", t.declining), stat("Tetap", t.stable)),
    h("p", { class: "mt-3 text-xs text-muted-foreground-1", text: "Dibandingkan dua penilaian terakhir tiap keluarga." }));
}

function upcomingSection(rows) {
  if (!rows.length) return section("Jadwal mendatang", emptyState("Belum ada jadwal mendatang.", "calendar"));
  return section("Jadwal mendatang",
    h("ul", { class: "divide-y divide-line-2" }, rows.map((s) => h("li", { class: "flex flex-wrap items-center justify-between gap-2 py-3" },
      h("div", { class: "min-w-0" },
        h("p", { class: "font-medium", text: s.title }),
        h("p", { class: "text-sm text-muted-foreground-1", text: [dateTimeID(s.scheduled_at), s.family_name].filter(Boolean).join(" · ") })),
      badge(label(SCHEDULE_TYPE, s.type), "trial")))),
    h("p", { class: "mt-3 text-sm" }, link("/schedules/", "Semua jadwal")));
}

// "Perlu Tindak Lanjut": tanda kerentanan keluarga dampingan (admin: semua keluarga).
function followUpSection(f) {
  const counts = h("div", { class: "flex flex-wrap gap-2" }, f.summary.counts.map((c) =>
    badge(`${c.label}: ${c.count}`, c.count ? "pending" : "neutral")));
  const intro = h("p", { class: "text-sm text-muted-foreground-1",
    text: `${f.summary.flagged_total} dari ${f.summary.families_total} keluarga perlu ditindaklanjuti.` });
  if (!f.families.length) return section("Perlu Tindak Lanjut", intro, h("div", { class: "mt-4" }, emptyState("Semua keluarga dalam keadaan baik.", "check-circle")));
  return section("Perlu Tindak Lanjut", intro, h("div", { class: "mt-3" }, counts),
    h("ul", { class: "mt-4 divide-y divide-line-2" }, f.families.slice(0, 10).map((row) => h("li", { class: "py-3" },
      h("div", { class: "flex flex-wrap items-center justify-between gap-2" },
        link(`/families/detail/?id=${encodeURIComponent(row.id)}`, row.head_name),
        h("span", { class: "text-xs text-muted-foreground-1", text: row.family_code })),
      h("ul", { class: "mt-2 space-y-1" }, row.flags.map((fl) => h("li", { class: "flex items-start gap-2 text-sm" },
        icon(fl.level === "warning" ? "alert-triangle" : "info", `mt-0.5 size-4 ${fl.level === "warning" ? "text-red-700 dark:text-red-300" : "text-primary-700 dark:text-primary-300"}`),
        h("span", {}, h("span", { class: "font-medium", text: fl.label + ": " }), fl.detail))))))));
}

// Sebaran wilayah per kecamatan (pengganti peta: CSP tidak mengizinkan skrip peta pihak ketiga).
function regionSection(rows) {
  if (!rows.length) return section("Sebaran wilayah", emptyState("Belum ada keluarga dengan koordinat lokasi.", "map-pin"));
  const by = new Map();
  for (const r of rows) {
    const key = [r.kecamatan, r.city].filter(Boolean).join(", ") || "—";
    const g = by.get(key) || { total: 0, pra_sejahtera: 0, sejahtera_1: 0, sejahtera_2: 0 };
    g.total++;
    g[r.welfare_status] = (g[r.welfare_status] || 0) + 1;
    by.set(key, g);
  }
  const sorted = [...by.entries()].sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "id"));
  return section("Sebaran wilayah",
    h("p", { class: "mb-3 text-sm text-muted-foreground-1", text: `${rows.length} keluarga berkoordinat, dikelompokkan per kecamatan.` }),
    table("Sebaran keluarga per kecamatan", ["Kecamatan", "Keluarga", "Pra-Sejahtera", "Sejahtera I", "Sejahtera II"],
      sorted.map(([k, g]) => [k, String(g.total), String(g.pra_sejahtera), String(g.sejahtera_1), String(g.sejahtera_2)])));
}

function renderStaff(d, monthly, follow, map) {
  mount(content, h("div", { class: "space-y-6" },
    kpis(d.families, d.finance),
    h("div", { class: "grid grid-cols-1 gap-6 lg:grid-cols-2" }, welfareSection(d.families), improvementSection(d.assessment_trends)),
    followUpSection(follow),
    h("div", { class: "grid grid-cols-1 gap-6 lg:grid-cols-2" }, monthlySection(monthly),
      h("div", { class: "space-y-6" }, upcomingSection(d.upcoming_schedules),
        section("Aktivitas bulan ini", h("p", { class: "text-3xl font-semibold", text: String(d.activities_this_month) }),
          h("p", { class: "mt-2 text-sm" }, link("/activities/", "Lihat aktivitas"))))),
    regionSection(map)));
}

function renderDonor(s, map) {
  mount(content, h("div", { class: "space-y-6" },
    kpis(s.families, s.finance),
    welfareSection(s.families),
    h("div", { class: "flex flex-wrap gap-2" },
      h("a", { href: api.withBase("/donations/new/"), class: "btn btn-primary" }, icon("plus"), "Donasi baru"),
      h("a", { href: api.withBase("/reports/"), class: "btn btn-outline" }, icon("file-text"), "Lihat laporan")),
    regionSection(map)));
}
