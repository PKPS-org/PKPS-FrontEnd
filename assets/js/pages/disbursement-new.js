import "../common.js";
import * as api from "../api.js";
import { h, mount, rupiah, toast, todayISO } from "../ui.js";
import { errorState, fieldFor, formShell, formValues, loadingState, startPage } from "../admin/kit.js";
import { AID_TYPE, options } from "../pkps.js";

const state = document.getElementById("state");
const content = document.getElementById("content");
const preset = new URLSearchParams(location.search).get("family") || "";

if (await startPage("distribusi", ["admin", "pendamping"])) await load();

async function load() {
  mount(state, loadingState());
  try {
    const opt = (await api.get("/api/disbursements/options")).data;
    mount(state);
    render(opt);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

function render(opt) {
  const family = fieldFor("family_id", "Keluarga penerima", { type: "select", required: true, empty: "— Pilih keluarga —",
    options: opt.families.map((f) => [f.id, `${f.head_name} (${f.family_code})`]), value: preset });
  const need = fieldFor("need_id", "Kebutuhan yang dipenuhi", { type: "select", empty: "— Tidak terkait kebutuhan —", options: [],
    hint: "Kebutuhan berstatus menunggu milik keluarga terpilih; statusnya otomatis menjadi terpenuhi." });
  const familySel = family.querySelector("select");
  const needSel = need.querySelector("select");
  const syncNeeds = () => {
    const keep = needSel.value;
    needSel.replaceChildren(h("option", { value: "", text: "— Tidak terkait kebutuhan —" }),
      opt.needs.filter((n) => n.family_id === familySel.value).map((n) => h("option", { value: n.id, text: n.title })));
    needSel.value = [...needSel.options].some((o) => o.value === keep) ? keep : "";
  };
  familySel.addEventListener("change", syncNeeds);
  syncNeeds();

  mount(content, formShell([
    family,
    h("div", { class: "grid gap-4 sm:grid-cols-2" },
      fieldFor("donation_id", "Sumber donasi", { type: "select", empty: "— Tanpa tautan donasi —",
        options: opt.donations.map((d) => [d.id, `${d.donation_code} · ${rupiah(d.amount)}${d.donor ? " · " + d.donor.name : ""}`]) }),
      need),
    h("div", { class: "grid gap-4 sm:grid-cols-2" },
      fieldFor("type", "Jenis bantuan", { type: "select", options: options(AID_TYPE), value: "uang", required: true }),
      fieldFor("amount", "Jumlah/nilai (Rp)", { type: "number", attrs: { min: "0", step: "1000" } }),
      fieldFor("disbursement_date", "Tanggal penyaluran", { type: "date", value: todayISO(), required: true, attrs: { max: todayISO() } }),
      fieldFor("recipient_name", "Nama penerima", { required: true, attrs: { maxlength: "100" } }),
      fieldFor("recipient_nik", "NIK penerima", { attrs: { inputmode: "numeric", maxlength: "16" } })),
    fieldFor("description", "Uraian bantuan", { attrs: { maxlength: "500" } }),
    fieldFor("photo_proof", "Foto bukti penyerahan", { type: "file", attrs: { accept: "image/jpeg,image/png,image/webp" }, hint: "Gambar, maks. 5 MB (dikecilkan otomatis)." }),
    fieldFor("notes", "Catatan", { type: "textarea" }),
  ], "Simpan distribusi", async (form) => {
    const file = form.querySelector('input[name="photo_proof"]').files[0];
    const res = await api.post("/api/disbursements", await api.formData(formValues(form), file ? { photo_proof: file } : {}));
    toast(res.message);
    api.go(`/disbursements/detail/?id=${encodeURIComponent(res.data.id)}`);
  }, { cancelHref: "/disbursements/" }));
}
