import "../common.js";
import * as api from "../api.js";
import { h, mount, toast, todayISO } from "../ui.js";
import { errorState, fieldFor, formShell, formValues, loadingState, startPage } from "../admin/kit.js";
import { PERIOD, SCORE_DIMENSIONS, options } from "../pkps.js";

const familyId = new URLSearchParams(location.search).get("family") || "";
const enc = encodeURIComponent(familyId);
const state = document.getElementById("state");
const content = document.getElementById("content");

if (await startPage("penilaian", ["admin", "pendamping"])) await load();

async function load() {
  mount(state, loadingState());
  try {
    const f = (await api.get(`/api/families/${enc}`)).data;
    mount(state);
    render(f);
  } catch (e) {
    mount(state, errorState(e.message, load));
  }
}

// Skor 1–5 sebagai kelompok tombol radio (satu fieldset per dimensi), dengan total yang dihitung langsung.
function scoreGroup(key, labelText) {
  return h("fieldset", { class: "rounded-xl border border-line-2 p-4" },
    h("legend", { class: "px-1 text-sm font-semibold", text: labelText }),
    h("div", { class: "mt-2 flex flex-wrap gap-2" }, [1, 2, 3, 4, 5].map((n) =>
      h("label", { class: "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line-3 px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950" },
        h("input", { type: "radio", name: "score_" + key, value: String(n), required: true, class: "accent-primary-700" }), String(n)))),
    h("div", { class: "mt-3" }, fieldFor("notes_" + key, "Catatan " + labelText.toLowerCase(), { type: "textarea", attrs: { rows: "2" } })));
}

function render(f) {
  document.getElementById("subtitle").textContent = `${f.head_name} · ${f.family_code}`;
  const total = h("p", { id: "total", role: "status", class: "text-sm font-medium", text: "Total: 0/25" });
  const form = formShell([
    h("div", { class: "grid gap-4 sm:grid-cols-2" },
      fieldFor("assessment_date", "Tanggal penilaian", { type: "date", value: todayISO(), required: true, attrs: { max: todayISO() } }),
      fieldFor("period", "Periode", { type: "select", options: options(PERIOD), value: "bulanan", required: true })),
    h("div", { class: "grid gap-4 md:grid-cols-2" }, Object.entries(SCORE_DIMENSIONS).map(([k, l]) => scoreGroup(k, l))),
    total,
    fieldFor("general_notes", "Catatan umum", { type: "textarea" }),
    fieldFor("recommendations", "Rekomendasi", { type: "textarea" }),
  ], "Simpan penilaian", async (formEl) => {
    const v = formValues(formEl);
    const body = {};
    for (const [k, val] of Object.entries(v)) if (val !== "") body[k] = /^score_/.test(k) ? Number(val) : val;
    await api.post(`/api/families/${enc}/assessments`, body);
    toast("Penilaian berhasil disimpan.");
    api.go(`/families/detail/?id=${enc}`);
  }, { cancelHref: `/families/detail/?id=${enc}` });
  form.addEventListener("change", () => {
    const sum = [...form.querySelectorAll('input[type="radio"]:checked')].reduce((s, r) => s + Number(r.value), 0);
    total.textContent = `Total: ${sum}/25`;
  });
  mount(content, form);
}
