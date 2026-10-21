import "../common.js";
import * as api from "../api.js";
import { dateLongID, h, icon, mount, rupiah } from "../ui.js";
import { errorState, idParam, loadingState, startPage } from "../admin/kit.js";
import { AID_TYPE, label } from "../pkps.js";

// Kwitansi penyaluran bantuan untuk dicetak (pengganti PDF disbursements.receipt Laravel).
const id = idParam();
const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startPage("distribusi", ["admin", "pendamping"])) await load();

async function load() {
  mount(state, loadingState());
  try {
    const d = (await api.get(`/api/disbursements/${encodeURIComponent(id)}`)).data;
    mount(state);
    render(d);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function row(k, v) {
  return h("tr", {}, h("th", { scope: "row", class: "w-48 py-2 pe-4 text-start align-top text-sm font-medium text-muted-foreground-1", text: k }),
    h("td", { class: "py-2 text-sm", text: v == null || v === "" ? "—" : v }));
}

function render(d) {
  document.getElementById("subtitle").textContent = d.disbursement_code;
  const print = h("button", { type: "button", class: "btn btn-primary" }, icon("printer"), "Cetak / Simpan PDF");
  print.addEventListener("click", () => window.print());
  mount(document.getElementById("actions"), print,
    h("a", { href: api.withBase(`/disbursements/detail/?id=${encodeURIComponent(d.id)}`), class: "btn btn-outline", text: "Kembali" }));
  mount(content, h("article", { id: "receipt", class: "card card-pad mx-auto max-w-3xl" },
    h("header", { class: "flex flex-wrap items-start justify-between gap-4 border-b border-line-2 pb-4" },
      h("div", {}, h("p", { class: "text-lg font-semibold", text: "PKPS — Pendampingan Keluarga Pra Sejahtera" }),
        h("p", { class: "text-sm text-muted-foreground-1", text: "Kwitansi penyaluran bantuan" })),
      h("div", { class: "text-end" }, h("p", { class: "font-mono text-sm font-semibold", text: d.disbursement_code }),
        h("p", { class: "text-sm text-muted-foreground-1", text: dateLongID(d.disbursement_date) }))),
    h("table", { class: "mt-4 w-full" }, h("tbody", {},
      row("Nama penerima", d.recipient_name), row("NIK penerima", d.recipient_nik),
      row("Keluarga", d.family ? `${d.family.head_name} (${d.family.family_code})` : ""),
      row("Alamat", d.family ? `${d.family.address}, ${d.family.kelurahan}, ${d.family.kecamatan}, ${d.family.city}` : ""),
      row("Jenis bantuan", label(AID_TYPE, d.type)), row("Uraian", d.description), row("Catatan", d.notes))),
    h("p", { class: "mt-4 rounded-xl bg-muted px-4 py-3 text-lg font-semibold", text: `Jumlah: ${d.amount == null ? "—" : rupiah(d.amount)}` }),
    h("div", { class: "mt-8 grid grid-cols-2 gap-6" },
      h("div", { class: "sign-box" }, h("span", { text: "Yang menyerahkan" }), h("span", { class: "font-medium", text: d.distributor ? d.distributor.name : "" })),
      h("div", { class: "sign-box" }, h("span", { text: "Yang menerima" }), h("span", { class: "font-medium", text: d.recipient_name })))));
}
