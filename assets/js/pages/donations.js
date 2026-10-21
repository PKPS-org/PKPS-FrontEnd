import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { dateID, h, icon, mount, rupiah, toast } from "../ui.js";
import { emptyState, errorState, field, link, loadingState, orDash, readQuery, select, startPage, table, writeQuery } from "../admin/kit.js";
import { confirmDialog } from "../admin/dialog.js";
import { renderPager } from "../admin/pager.js";
import { AID_TYPE, DONATION_STATUS, donationBadge, label, options } from "../pkps.js";

const DEFAULTS = { status: "", page: "1" };
const query = readQuery(DEFAULTS);
const state = document.getElementById("state");
const content = document.getElementById("content");
const pager = document.getElementById("pager");
const role = () => (session.getUser() || {}).role;
let seq = 0;

if (await startPage("donasi")) {
  if (role() === "donatur") {
    document.getElementById("subtitle").textContent = "Donasi yang pernah Anda berikan.";
    mount(document.getElementById("actions"), h("a", { href: api.withBase("/donations/new/"), class: "btn btn-primary" }, icon("plus"), "Donasi baru"));
  }
  const status = select([["", "Semua"], ...options(DONATION_STATUS)], query.status);
  mount(document.getElementById("filters"), h("div", { class: "max-w-xs" }, field("f-status", "Status", status)));
  status.addEventListener("change", () => { query.status = status.value; query.page = "1"; load(); });
  await load();
}

async function load() {
  const mine = ++seq;
  writeQuery(query, DEFAULTS);
  mount(state, loadingState());
  const p = new URLSearchParams({ per_page: "15", page: query.page });
  if (query.status) p.set("status", query.status);
  try {
    const res = await api.get("/api/donations?" + p);
    if (mine !== seq) return;
    mount(state);
    render(res);
  } catch (e) {
    if (mine === seq) mount(state, errorState(e.message, load));
  }
}

function confirmButton(d) {
  if (d.status !== "pending" || role() === "donatur") return "";
  const b = h("button", { type: "button", class: "btn btn-outline btn-sm" }, icon("check"), "Konfirmasi");
  b.addEventListener("click", async () => {
    const ok = await confirmDialog({ title: "Konfirmasi donasi?", message: `${d.donation_code} · ${rupiah(d.amount)} dari ${d.donor ? d.donor.name : "donatur"}. Pastikan dana atau barang sudah diterima.`,
      confirmLabel: "Konfirmasi", onConfirm: () => api.put(`/api/donations/${encodeURIComponent(d.id)}/confirm`) });
    if (ok) { toast("Donasi berhasil dikonfirmasi."); load(); }
  });
  return b;
}

function render(res) {
  if (!res.data.length) {
    mount(content, emptyState("Belum ada donasi.", "wallet"));
    mount(pager);
    return;
  }
  mount(content, table("Daftar donasi", ["Kode", "Donatur", "Jenis", "Jumlah", "Tanggal", "Status", ""],
    res.data.map((d) => [
      link(`/donations/detail/?id=${encodeURIComponent(d.id)}`, d.donation_code),
      orDash(d.donor && d.donor.name), label(AID_TYPE, d.type),
      h("span", { class: "whitespace-nowrap", text: rupiah(d.amount) }), h("span", { class: "whitespace-nowrap", text: dateID(d.donation_date) }),
      donationBadge(d.status), confirmButton(d),
    ])));
  renderPager(pager, res.meta, (page) => { query.page = String(page); load(); });
}
