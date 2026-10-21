// Navigasi panel: sidebar tetap di layar lebar, laci geser di ponsel. Isi menu per peran mengikuti
// layouts/app.blade.php Laravel. Dirender ke <div id="admin-nav"> oleh startPage(); halaman memberi
// ruang lewat lg:ps-64 pada pembungkusnya.
import * as api from "../api.js";
import * as session from "../session.js";
import { syncToggles } from "../common.js";
import { setupDrawer } from "../drawer.js";
import { h, icon, logoMark, mount } from "../ui.js";
import { avatar } from "./kit.js";

const STAFF = ["admin", "pendamping"];
const ALL = ["admin", "pendamping", "donatur"];

// [kelompok, [kunci, jalur, label, ikon, peran]]
const GROUPS = [
  ["Menu utama", [
    ["dasbor", "/dashboard/", "Dashboard", "layout-dashboard", ALL],
    ["keluarga", "/families/", "Data Keluarga", "users", STAFF],
  ]],
  ["Keuangan", [
    ["donasi", "/donations/", "Donasi", "wallet", ALL],
    ["distribusi", "/disbursements/", "Distribusi", "package", STAFF],
  ]],
  ["Agenda", [
    ["jadwal", "/schedules/", "Jadwal", "calendar", STAFF],
    ["aktivitas", "/activities/", "Aktivitas", "activity", STAFF],
  ]],
  ["Monev", [
    ["penilaian", "/assessments/", "Penilaian", "clipboard-list", STAFF],
    ["laporan", "/reports/", "Laporan", "file-text", ALL],
  ]],
];

const ROLE_LABEL = { admin: "Administrator", pendamping: "Pendamping", donatur: "Donatur" };

export function renderAdminNav(active) {
  const host = document.getElementById("admin-nav");
  if (!host) return;
  const user = session.getUser() || {};
  const role = user.role || "";
  let activeLabel = "";

  const groups = GROUPS.map(([title, items]) => {
    const visible = items.filter((it) => it[4].includes(role));
    if (!visible.length) return null;
    return h("div", { class: "space-y-1" },
      h("p", { class: "px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground-1", text: title }),
      visible.map(([key, path, label, ico]) => {
        if (key === active) activeLabel = label;
        return h("a", { href: api.withBase(path), class: "side-link", "aria-current": key === active ? "page" : null }, icon(ico, "size-[18px]"), label);
      }));
  });

  const aside = h("aside", {
    id: "admin-menu",
    class: "invisible fixed inset-y-0 start-0 z-50 flex w-64 -translate-x-full flex-col border-e border-sidebar-line bg-sidebar drawer lg:visible lg:translate-x-0",
  },
    h("div", { class: "flex h-14 shrink-0 items-center px-5" },
      h("a", { href: api.withBase("/dashboard/"), class: "brand", "aria-label": "PKPS, dasbor" }, logoMark(), h("span", { text: "PKPS" }))),
    h("nav", { "aria-label": "Menu utama", class: "flex-1 overflow-y-auto px-3 pb-4" }, groups),
    h("div", { class: "border-t border-sidebar-line p-3" },
      h("div", { class: "flex items-center gap-3 rounded-xl px-2 py-2" },
        avatar(user.name || "Pengguna"),
        h("div", { class: "min-w-0" },
          h("p", { class: "truncate text-sm font-semibold", text: user.name || "Pengguna" }),
          h("p", { class: "text-xs text-muted-foreground-1", text: ROLE_LABEL[role] || role }))),
      h("button", { type: "button", "data-logout": "", class: "side-link mt-1 w-full text-start" }, icon("log-out", "size-[18px]"), "Keluar")));

  const backdrop = h("div", { class: "fixed inset-0 z-40 hidden bg-black/45 backdrop-blur-[2px] lg:hidden", "aria-hidden": "true", data: { backdrop: "1" } });
  // Nama tetap ("Menu"); keadaannya hanya lewat aria-expanded (label yang ikut berubah akan terbaca ganda).
  const toggle = h("button", { type: "button", "aria-expanded": "false", "aria-controls": "admin-menu", "aria-label": "Menu", class: "icon-btn lg:hidden print:hidden" }, icon("menu", "size-4"));
  const header = h("header", { class: "sticky top-0 z-30 border-b border-navbar-line bg-navbar/85 backdrop-blur-md lg:ps-64 print:hidden" },
    h("div", { class: "flex h-14 items-center gap-3 px-4 sm:px-6" },
      toggle,
      h("span", { class: "text-lg font-semibold lg:hidden", text: "PKPS" }),
      h("p", { class: "hidden items-center gap-2 text-sm lg:flex" },
        h("span", { class: "text-muted-foreground-1", text: "Pendampingan Keluarga Pra Sejahtera" }), icon("chevron-right", "size-3.5 text-muted-foreground-1"),
        h("span", { class: "font-medium", text: activeLabel })),
      h("div", { class: "ms-auto flex items-center gap-2" },
        h("button", { type: "button", "data-theme-toggle": "", class: "icon-btn" }))));

  mount(host, header, backdrop, aside);
  aside.classList.add("print:hidden");
  syncToggles();
  setupDrawer({
    panel: aside, toggles: [toggle], closers: [backdrop], label: "Menu",
    inertTargets: () => [header, document.getElementById("main"), document.querySelector('a[href="#main"]')],
  });
}
