import "../common.js";
import * as api from "../api.js";
import { dateID, dateTimeID, h, icon, mount, rupiah } from "../ui.js";
import { details, errorState, idParam, link, loadingState, section, startPage } from "../admin/kit.js";
import { AID_TYPE, label, needBadge } from "../pkps.js";

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

function render(d) {
  document.getElementById("title").textContent = d.disbursement_code;
  document.getElementById("subtitle").textContent = `Penyaluran ${label(AID_TYPE, d.type).toLowerCase()} · ${dateID(d.disbursement_date)}`;
  mount(document.getElementById("actions"),
    h("a", { href: api.withBase(`/disbursements/receipt/?id=${encodeURIComponent(d.id)}`), class: "btn btn-primary" }, icon("printer"), "Cetak kwitansi"));
  mount(content, h("div", { class: "space-y-6" },
    section("Rincian penyaluran", details([
      ["Kode", d.disbursement_code], ["Tanggal", dateID(d.disbursement_date)],
      ["Keluarga", d.family ? link(`/families/detail/?id=${encodeURIComponent(d.family.id)}`, d.family.head_name) : ""],
      ["Penerima", d.recipient_name], ["NIK penerima", d.recipient_nik],
      ["Jenis", label(AID_TYPE, d.type)], ["Jumlah/nilai", d.amount == null ? "" : rupiah(d.amount)],
      ["Uraian", d.description], ["Catatan", d.notes],
      ["Sumber donasi", d.donation ? `${d.donation.donation_code} · ${rupiah(d.donation.amount)}` : ""],
      ["Kebutuhan", d.need ? h("span", { class: "inline-flex flex-wrap items-center gap-2" }, d.need.title, needBadge(d.need.status)) : ""],
      ["Disalurkan oleh", d.distributor && d.distributor.name], ["Dicatat", dateTimeID(d.created_at)],
    ])),
    d.proof_url ? section("Bukti penyerahan", h("img", { src: d.proof_url, alt: "Bukti penyerahan " + d.disbursement_code, class: "thumb max-w-md" })) : null));
}
