import "../common.js";
import * as api from "../api.js";
import { dateID, h, icon, mount, rupiah } from "../ui.js";
import { emptyState, errorState, link, loadingState, orDash, readQuery, startPage, table, writeQuery } from "../admin/kit.js";
import { renderPager } from "../admin/pager.js";
import { AID_TYPE, label } from "../pkps.js";

const DEFAULTS = { page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
let seq = 0;

if (await startPage("distribusi", ["admin", "pendamping"])) {
  mount(document.getElementById("actions"), h("a", { href: api.withBase("/disbursements/new/"), class: "btn btn-primary" }, icon("plus"), "Distribusi baru"));
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  try {
    const res = await api.get("/api/disbursements?page=" + encodeURIComponent(query.page));
    if (mine !== seq) return;
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function render(res) {
  if (!res.data.length) {
    mount(content, emptyState("Belum ada penyaluran bantuan.", "package"));
    mount(pager);
    return;
  }
  mount(content, table("Daftar distribusi", ["Kode", "Keluarga", "Penerima", "Jenis", "Jumlah", "Tanggal", ""],
    res.data.map((d) => [
      link(`/disbursements/detail/?id=${encodeURIComponent(d.id)}`, d.disbursement_code),
      orDash(d.family && d.family.head_name), d.recipient_name, label(AID_TYPE, d.type),
      d.amount == null ? "—" : h("span", { class: "whitespace-nowrap", text: rupiah(d.amount) }),
      h("span", { class: "whitespace-nowrap", text: dateID(d.disbursement_date) }),
      h("a", { href: api.withBase(`/disbursements/receipt/?id=${encodeURIComponent(d.id)}`), class: "btn btn-outline btn-sm" }, icon("printer"), "Kwitansi"),
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
