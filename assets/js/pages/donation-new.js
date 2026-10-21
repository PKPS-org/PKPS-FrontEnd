import "../common.js";
import * as api from "../api.js";
import { h, mount, toast, todayISO } from "../ui.js";
import { fieldFor, formShell, formValues, startPage } from "../admin/kit.js";
import { AID_TYPE, options } from "../pkps.js";

const content = document.getElementById("content");

if (await startPage("donasi", ["donatur"])) {
  mount(content, formShell([
    h("div", { class: "grid gap-4 sm:grid-cols-2" },
      fieldFor("amount", "Jumlah (Rp)", { type: "number", required: true, attrs: { min: "1000", step: "1000" }, hint: "Minimal Rp 1.000. Untuk barang atau jasa, isi perkiraan nilainya." }),
      fieldFor("type", "Jenis donasi", { type: "select", options: options(AID_TYPE), value: "uang", required: true }),
      fieldFor("donation_date", "Tanggal donasi", { type: "date", value: todayISO(), required: true, attrs: { max: todayISO() } })),
    fieldFor("description", "Keterangan", { attrs: { maxlength: "500" } }),
    fieldFor("transfer_proof", "Bukti transfer", { type: "file", attrs: { accept: "image/jpeg,image/png,application/pdf" }, hint: "JPG, PNG, atau PDF, maks. 5 MB (gambar dikecilkan otomatis)." }),
    fieldFor("notes", "Catatan", { type: "textarea" }),
  ], "Kirim donasi", async (form) => {
    const file = form.querySelector('input[name="transfer_proof"]').files[0];
    const res = await api.post("/api/donations", await api.formData(formValues(form), file ? { transfer_proof: file } : {}));
    toast(res.message);
    api.go(`/donations/detail/?id=${encodeURIComponent(res.data.id)}`);
  }, { cancelHref: "/donations/" }));
}
