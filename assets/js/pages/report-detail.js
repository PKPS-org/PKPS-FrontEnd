import "../common.js";
import * as api from "../api.js";
import { dateLongID, dateTimeID, h, icon, mount, rupiah } from "../ui.js";
import { errorState, idParam, loadingState, startPage, stat, table } from "../admin/kit.js";
import { makeChart } from "../admin/charts.js";
import { REPORT_TYPE, SCORE_DIMENSIONS, WELFARE, label } from "../pkps.js";

// Halaman cetak laporan (pengganti PDF reports/pdf.blade.php Laravel).
const id = idParam();
const state = document.getElementById("state");
const content = document.getElementById("content");
// Dideklarasikan sebelum await tingkat modul (fungsi di bawah dipanggil saat await berjalan).
const h2 = (text) => h("h2", { class: "mt-8 border-s-4 border-primary ps-3 text-lg font-semibold", text });

if (await startPage("laporan")) await load();

async function load() {
  mount(state, loadingState());
  try {
    const r = (await api.get(`/api/reports/${encodeURIComponent(id)}`)).data;
    mount(state);
    render(r);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function render(r) {
  const s = r.summary_data || {};
  document.getElementById("title").textContent = "Laporan Program";
  document.title = `${r.report_code} | PKPS`;
  document.getElementById("subtitle").textContent = r.title;
  const print = h("button", { type: "button", class: "btn btn-primary" }, icon("printer"), "Cetak / Simpan PDF");
  print.addEventListener("click", () => window.print());
  mount(document.getElementById("actions"), print, h("a", { href: api.withBase("/reports/"), class: "btn btn-outline", text: "Kembali" }));

  const total = s.total_families || 0;
  const welfareKeys = ["pra_sejahtera", "sejahtera_1", "sejahtera_2"];
  const canvas = h("canvas", { role: "img", "aria-label": "Diagram sebaran status kesejahteraan" });
  const avg = s.avg_assessment || {};

  mount(content, h("article", { id: "report", class: "card card-pad" },
    h("header", { class: "flex flex-wrap items-start justify-between gap-4 border-b-2 border-primary pb-4" },
      h("div", {}, h("p", { class: "text-2xl font-bold text-primary-700 dark:text-primary-300", text: "PKPS" }),
        h("p", { class: "text-sm text-muted-foreground-1", text: "Pendampingan Keluarga Pra-Sejahtera" })),
      h("div", { class: "text-end text-sm" }, h("p", { class: "font-semibold", text: r.report_code }),
        h("p", { text: `Dibuat ${dateTimeID(r.created_at)}` }), r.generator ? h("p", { text: `Oleh ${r.generator.name}` }) : null)),
    h("p", { class: "mt-4 rounded-xl bg-muted px-4 py-3 text-sm" }, h("strong", { text: "Periode laporan: " }),
      `${dateLongID(r.period_start)} s.d. ${dateLongID(r.period_end)} · Jenis: ${label(REPORT_TYPE, r.type)}`),

    h2("1. Ringkasan eksekutif"),
    h("div", { class: "mt-4 grid gap-3 sm:grid-cols-3" },
      stat("Total keluarga", total), stat("Keluarga baru", s.new_families ?? 0), stat("Kegiatan", s.activities_count ?? 0),
      stat("Donasi masuk", rupiah(s.donations_in)), stat("Telah disalurkan", rupiah(s.disbursed)), stat("Saldo", rupiah(s.balance))),

    h2("2. Sebaran status kesejahteraan"),
    h("div", { class: "mt-4 grid items-center gap-6 md:grid-cols-2" },
      table("Sebaran status kesejahteraan", ["Status", "Jumlah keluarga", "Persentase"], welfareKeys.map((k) => {
        const n = (s.welfare_breakdown || {})[k] || 0;
        return [label(WELFARE, k), String(n), total ? `${(Math.round((n / total) * 1000) / 10).toLocaleString("id-ID")}%` : "0%"];
      })),
      h("div", { class: "relative h-56 break-avoid" }, canvas)),

    h2("3. Rata-rata penilaian kondisi keluarga"),
    h("p", { class: "mt-2 text-sm text-muted-foreground-1", text: "Skor 1–5 per dimensi (5 = sangat baik), dari penilaian dalam periode ini." }),
    h("div", { class: "mt-4 space-y-3" }, Object.entries(SCORE_DIMENSIONS).map(([k, l]) => {
      const v = Number(avg[k] || 0);
      return h("div", { class: "grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-sm" },
        h("span", { text: l }),
        h("progress", { class: "meter", max: "5", value: String(v), "aria-label": `${l}: ${v.toFixed(2)} dari 5` }),
        h("span", { class: "text-end font-medium", text: v.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
    })),
    h("p", { class: "mt-3 text-sm" }, "Rata-rata keseluruhan: ", h("strong", { text: `${Number(avg.score || 0).toLocaleString("id-ID", { minimumFractionDigits: 2 })} / 5,00` })),
    r.notes ? h("div", {}, h2("Catatan"), h("p", { class: "mt-2 text-sm", text: r.notes })) : null,
    h("footer", { class: "mt-10 border-t border-line-2 pt-3 text-xs text-muted-foreground-1",
      text: `Dokumen ini dibuat otomatis oleh Sistem PKPS · ${r.report_code}` })));

  makeChart(canvas, (t) => ({
    type: "doughnut",
    data: { labels: welfareKeys.map((k) => label(WELFARE, k)), datasets: [{ data: welfareKeys.map((k) => (s.welfare_breakdown || {})[k] || 0), backgroundColor: [t.c.accent, t.c.light, t.c.strong], borderWidth: 0 }] },
    options: { plugins: { legend: { position: "bottom" } } },
  }));
}
