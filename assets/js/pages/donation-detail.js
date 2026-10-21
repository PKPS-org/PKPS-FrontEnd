import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";
import { dateID, dateTimeID, h, icon, mount, rupiah, toast } from "../ui.js";
import { details, errorState, idParam, loadingState, section, startPage } from "../admin/kit.js";
import { confirmDialog } from "../admin/dialog.js";
import { AID_TYPE, donationBadge, label } from "../pkps.js";

const id = idParam();
const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startPage("donasi")) await load();

async function load() {
  mount(state, loadingState());
  try {
    const d = (await api.get(`/api/donations/${encodeURIComponent(id)}`)).data;
    mount(state);
    render(d);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function proof(d) {
  if (!d.proof_url) return section("Bukti transfer", h("p", { class: "text-sm text-muted-foreground-1", text: "Tidak ada bukti yang diunggah." }));
  return section("Bukti transfer",
    h("img", { src: d.proof_url, alt: "Bukti transfer " + d.donation_code, class: "thumb max-w-md", on: { error: (e) => e.target.replaceWith(pdfLink(d)) } }));
}

// Bukti berupa PDF tidak bisa tampil sebagai <img>; ganti dengan tautan yang membuka berkasnya.
function pdfLink(d) {
  return h("a", { href: d.proof_url, target: "_blank", rel: "noopener", class: "btn btn-outline" }, icon("file-text"), "Buka bukti (PDF)");
}

function render(d) {
  document.getElementById("title").textContent = d.donation_code;
  document.getElementById("subtitle").textContent = `Donasi ${label(AID_TYPE, d.type).toLowerCase()} · ${dateID(d.donation_date)}`;
  const role = (session.getUser() || {}).role;
  if (d.status === "pending" && role !== "donatur") {
    const b = h("button", { type: "button", class: "btn btn-primary" }, icon("check"), "Konfirmasi");
    b.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: "Konfirmasi donasi?", message: `${rupiah(d.amount)} dari ${d.donor ? d.donor.name : "donatur"}.`, confirmLabel: "Konfirmasi",
        onConfirm: () => api.put(`/api/donations/${encodeURIComponent(d.id)}/confirm`) });
      if (ok) { toast("Donasi berhasil dikonfirmasi."); load(); }
    });
    mount(document.getElementById("actions"), b);
  } else {
    mount(document.getElementById("actions"));
  }
  mount(content, h("div", { class: "space-y-6" },
    section("Rincian donasi", details([
      ["Kode", d.donation_code], ["Status", donationBadge(d.status)], ["Donatur", d.donor && d.donor.name],
      ["Jenis", label(AID_TYPE, d.type)], ["Jumlah", rupiah(d.amount)], ["Tanggal donasi", dateID(d.donation_date)],
      ["Keterangan", d.description], ["Catatan", d.notes],
      ["Dikonfirmasi oleh", d.confirmed_by], ["Dikonfirmasi pada", dateTimeID(d.confirmed_at)], ["Dicatat", dateTimeID(d.created_at)],
    ])),
    proof(d)));
}
