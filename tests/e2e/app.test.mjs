// Uji peramban (Chrome sungguhan lewat playwright-core) terhadap backend Go dan situs yang dinyalakan oleh
// run.mjs, dengan data demo tools/seed-demo (semua sandi "password"). Tiap tes memeriksa juga bahwa tidak ada
// pelanggaran CSP atau galat skrip di konsol. Tes berjalan berurutan dan berbagi beberapa data (keluarga baru).
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const API = process.env.E2E_API, WEB = process.env.E2E_WEB, TMP = process.env.E2E_TMP;
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = new URL(WEB).pathname.replace(/\/+$/, "");
const PASSWORD = "password";
const ADMIN = { email: "admin@pkps.app", password: PASSWORD };
const PENDAMPING = { email: "pendamping1@pkps.app", password: PASSWORD };
const DONATUR = { email: "donatur@pkps.app", password: PASSWORD };
const KELUARGA = { email: "keluarga1@pkps.app", password: PASSWORD };
const nik = "3273" + String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 9000) + 1000);
const headName = "Keluarga E2E " + randomBytes(2).toString("hex");
const shared = { familyId: "" };

// PNG 1x1 untuk unggahan.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

let browser;
const issues = [];

before(async () => {
  mkdirSync(resolve(TMP, "shots"), { recursive: true });
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
});
after(async () => { await browser?.close(); });

// ── Pembantu ──
let ipSeq = 0;
async function api(path, { method = "GET", body, token } = {}) {
  // Login dibatasi 5/menit per IP: tiap panggilan API memakai X-Forwarded-For sendiri.
  ipSeq++;
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-Forwarded-For": `10.9.${ipSeq % 250}.${(ipSeq >> 8) % 250 + 1}`,
      ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// Sesi per akun disimpan: token berlaku 30 hari, jadi satu login cukup untuk semua tes.
const sessions = new Map();
async function login(user) {
  if (sessions.has(user.email)) return sessions.get(user.email);
  const r = await api("/api/auth/login", { method: "POST", body: { email: user.email, password: user.password } });
  assert.equal(r.status, 200, "login API " + user.email);
  sessions.set(user.email, r.data.data);
  return r.data.data;
}

async function newPage({ viewport = { width: 1280, height: 900 }, colorScheme = "light", session } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, acceptDownloads: true });
  if (session) {
    await context.addInitScript(([t, u]) => {
      localStorage.setItem("pkps_token", t);
      localStorage.setItem("pkps_user", JSON.stringify(u));
    }, [session.token, session.user]);
  }
  const page = await context.newPage();
  page.on("console", (m) => {
    const t = m.text();
    if (/content security policy|violates the following/i.test(t)) issues.push("[CSP] " + t.slice(0, 220));
  });
  page.on("pageerror", (e) => issues.push("[galat skrip] " + e.message));
  return { context, page };
}

async function authed(user, opts = {}) {
  const s = await login(user);
  return newPage({ ...opts, session: { token: s.token, user: s.user } });
}

const shot = (page, name) => page.screenshot({ path: resolve(TMP, "shots", name + ".png"), fullPage: true });
function noIssues() { assert.deepEqual(issues.splice(0), [], "tidak boleh ada pelanggaran CSP atau galat skrip"); }

// Teks bocor dari bug JS ("null", "undefined", "[object ...]") tidak boleh tampil di halaman.
async function noLeakyText(page, label) {
  const text = await page.evaluate(() => document.body.innerText);
  assert.doesNotMatch(text, /(^|[^\p{L}\p{N}_])(null|undefined|NaN)([^\p{L}\p{N}_]|$)|\[object /u, `teks bocor di ${label}`);
}

// Tidak boleh ada gulir horizontal pada halaman (kecuali di dalam pembungkus yang memang dapat digulir).
async function noPageOverflow(page, label) {
  const w = await page.evaluate(() => {
    // Elemen yang melewati tepi kanan (di luar pembungkus yang memang bisa digulir), untuk pesan galat.
    const wide = [...document.querySelectorAll("body *")].filter((el) => {
      if (el.closest(".overflow-x-auto")) return false;
      return el.getBoundingClientRect().right > window.innerWidth + 1;
    }).filter((el, _, all) => !all.some((o) => o !== el && el.contains(o)))
      .slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 4).join(".")} "${(el.textContent || "").trim().slice(0, 30)}"`);
    return [document.documentElement.scrollWidth, window.innerWidth, wide];
  });
  assert.ok(w[0] <= w[1], `${label}: lebar dokumen ${w[0]} melebihi viewport ${w[1]}; terlebar: ${w[2].join("; ")}`);
}

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const v = r.violations.map((x) => `${x.id}: ${x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  assert.deepEqual(v, [], `pelanggaran aksesibilitas di ${label}`);
}

async function goto(page, path) {
  await page.goto(WEB + path);
  await page.waitForLoadState("networkidle");
}

// Menunggu konten halaman panel termuat (status "Memuat..." hilang). Galat muat langsung menggagalkan tes
// dengan teks galatnya, bukan menunggu sampai batas waktu.
async function loaded(page) {
  await page.waitForFunction(() => document.querySelector("#content > *") || document.querySelector("#state [role=alert]"));
  if (await page.locator("#state [role=alert]").count()) assert.fail(`galat muat ${page.url()}: ${await page.locator("#state").innerText()}`);
  await page.waitForFunction(() => !document.querySelector("#state [role=status]"));
}

// ── Tes ──

test("masuk sebagai admin, pendamping, dan donatur lewat formulir", async () => {
  for (const [user, nav] of [[ADMIN, "Data Keluarga"], [PENDAMPING, "Penilaian"], [DONATUR, "Donasi"]]) {
    const { context, page } = await newPage();
    await goto(page, "/login/");
    await page.fill("#email", user.email);
    await page.fill("#password", user.password);
    await page.click("#submit");
    await page.waitForURL("**/dashboard/");
    await loaded(page);
    await page.getByRole("link", { name: nav }).first().waitFor();
    await noLeakyText(page, "dasbor " + user.email);
    if (user === DONATUR) assert.equal(await page.getByRole("link", { name: "Data Keluarga" }).count(), 0, "donatur tidak melihat menu keluarga");
    await shot(page, "dasbor-" + user.email.split("@")[0]);
    await context.close();
  }
  noIssues();
});

test("akun keluarga ditolak di web dengan pesan Laravel", async () => {
  const { context, page } = await newPage();
  await goto(page, "/login/");
  await page.fill("#email", KELUARGA.email);
  await page.fill("#password", KELUARGA.password);
  await page.click("#submit");
  await page.locator("#form-error:not(.hidden)").waitFor();
  assert.equal(await page.locator("#form-error").textContent(), "Akun keluarga menggunakan aplikasi mobile Keluarga Mandiri.");
  assert.equal(await page.evaluate(() => localStorage.getItem("pkps_token")), null, "sesi keluarga dihapus");
  await page.fill("#password", "salah-sekali");
  await page.click("#submit");
  await page.waitForFunction(() => document.querySelector("#form-error").textContent.includes("Email atau password salah"));
  noIssues();
  await context.close();
});

test("pendamping membuat keluarga (kredensial tampil), mengubah, lalu melihat detail", async () => {
  const { context, page } = await authed(PENDAMPING);
  await goto(page, "/families/new/");
  await loaded(page);
  await page.fill('[name="head_name"]', headName);
  await page.fill('[name="nik_head"]', nik);
  await page.fill('[name="address"]', "Jl. Uji E2E No. 1");
  await page.fill('[name="rt_rw"]', "001/002");
  await page.fill('[name="kelurahan"]', "Sukapura");
  await page.fill('[name="kecamatan"]', "Dayeuhkolot");
  await page.fill('[name="city"]', "Bandung");
  await page.fill('[name="monthly_income"]', "1500000");
  await page.setInputFiles('[name="photo"]', { name: "rumah.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Daftarkan keluarga" }).click();
  await page.locator("#account").waitFor();
  assert.match(await page.locator("#account-email").textContent(), /^ebi-\d{4}-\d{4}@pkps\.app$/);
  assert.equal(await page.locator("#account-password").textContent(), "pkps" + nik.slice(-4));
  await shot(page, "keluarga-baru");
  await page.getByRole("link", { name: "Lihat detail keluarga" }).click();
  await page.waitForURL("**/families/detail/?id=*");
  shared.familyId = new URL(page.url()).searchParams.get("id");
  await loaded(page);
  assert.equal(await page.locator("#title").textContent(), headName);
  assert.ok(await page.locator(`img[alt="Foto keluarga ${headName}"]`).evaluate((img) => img.complete && img.naturalWidth > 0), "foto keluarga tampil");

  await page.getByRole("link", { name: "Ubah" }).click();
  await page.waitForURL("**/families/edit/?id=*");
  await loaded(page);
  await page.fill('[name="notes"]', "Diubah lewat uji E2E");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  await page.waitForURL("**/families/detail/?id=*");
  await loaded(page);
  await page.getByText("Diubah lewat uji E2E").waitFor();
  await noLeakyText(page, "detail keluarga");
  noIssues();
  await context.close();
});

test("verifikasi kebutuhan dan penilaian baru", async () => {
  const pend = await login(PENDAMPING);
  const need = await api(`/api/families/${shared.familyId}/needs`, { method: "POST", token: pend.token, body: { title: "Seragam sekolah", category: "pendidikan", priority: "high" } });
  assert.equal(need.status, 201);
  const { context, page } = await newPage({ session: pend });
  await goto(page, `/families/detail/?id=${shared.familyId}`);
  await loaded(page);
  await page.getByRole("button", { name: "Verifikasi" }).click();
  await page.locator("dialog").getByRole("button", { name: "Verifikasi" }).click();
  await page.getByText("Terverifikasi").first().waitFor();

  await page.getByRole("link", { name: "Penilaian baru" }).click();
  await page.waitForURL("**/assessments/new/?family=*");
  await loaded(page);
  for (const [dim, score] of [["ekonomi", 3], ["kesehatan", 4], ["pendidikan", 2], ["hunian", 3], ["sosial", 4]]) {
    await page.locator(`input[name="score_${dim}"][value="${score}"]`).check();
  }
  assert.equal(await page.locator("#total").textContent(), "Total: 16/25");
  await page.getByRole("button", { name: "Simpan penilaian" }).click();
  await page.waitForURL("**/families/detail/?id=*");
  await loaded(page);
  await page.getByText("16/25").first().waitFor();
  noIssues();
  await context.close();
});

test("donatur berdonasi dengan bukti, pendamping mengonfirmasi", async () => {
  const d = await newPage({ session: await login(DONATUR) });
  await goto(d.page, "/donations/new/");
  await loaded(d.page);
  await d.page.fill('[name="amount"]', "250000");
  await d.page.fill('[name="description"]', "Donasi uji E2E");
  await d.page.setInputFiles('[name="transfer_proof"]', { name: "bukti.png", mimeType: "image/png", buffer: PNG });
  await d.page.getByRole("button", { name: "Kirim donasi" }).click();
  await d.page.waitForURL("**/donations/detail/?id=*");
  await loaded(d.page);
  const code = await d.page.locator("#title").textContent();
  assert.match(code, /^DON-\d{6}-\d{4}$/);
  assert.ok(await d.page.locator("img[alt^='Bukti transfer']").evaluate((img) => img.complete && img.naturalWidth > 0), "bukti tampil");
  await d.context.close();

  const p = await authed(PENDAMPING);
  await goto(p.page, "/donations/?status=pending");
  await loaded(p.page);
  const row = p.page.locator("tr", { hasText: code });
  await row.getByRole("button", { name: "Konfirmasi" }).click();
  await p.page.locator("dialog").getByRole("button", { name: "Konfirmasi" }).click();
  await p.page.getByText("Donasi berhasil dikonfirmasi.").waitFor();
  noIssues();
  await p.context.close();
});

test("distribusi bantuan lalu kwitansi tampil", async () => {
  const { context, page } = await authed(PENDAMPING);
  await goto(page, `/disbursements/new/?family=${shared.familyId}`);
  await loaded(page);
  await page.selectOption('[name="type"]', "barang");
  await page.fill('[name="amount"]', "150000");
  await page.fill('[name="recipient_name"]', "Ibu Penerima E2E");
  await page.fill('[name="description"]', "Paket sembako");
  await page.getByRole("button", { name: "Simpan distribusi" }).click();
  await page.waitForURL("**/disbursements/detail/?id=*");
  await loaded(page);
  await page.getByRole("link", { name: "Cetak kwitansi" }).click();
  await page.waitForURL("**/disbursements/receipt/?id=*");
  await page.locator("#receipt").waitFor();
  const text = await page.locator("#receipt").innerText();
  for (const want of ["Ibu Penerima E2E", headName, "Paket sembako", "Rp 150.000", "Yang menyerahkan", "Yang menerima"]) assert.ok(text.includes(want), `kwitansi memuat ${want}`);
  await page.emulateMedia({ media: "print" });
  assert.equal(await page.locator("#admin-menu").isVisible(), false, "navigasi disembunyikan saat cetak");
  await shot(page, "kwitansi");
  noIssues();
  await context.close();
});

test("admin membuat laporan lalu halaman cetak tampil; ekspor Excel terunduh", async () => {
  const { context, page } = await authed(ADMIN);
  await goto(page, "/reports/");
  await loaded(page);
  await page.getByRole("button", { name: "Buat laporan" }).click();
  await page.waitForURL("**/reports/detail/?id=*");
  await loaded(page);
  const text = await page.locator("#report").innerText();
  for (const want of ["Ringkasan eksekutif", "Sebaran status kesejahteraan", "Rata-rata penilaian kondisi keluarga"]) assert.ok(text.includes(want), `laporan memuat ${want}`);
  assert.match(text, /RPT-\d{4}-\d{4}/);
  await shot(page, "laporan");

  await goto(page, "/families/");
  await loaded(page);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Ekspor Excel" }).click()]);
  assert.match(download.suggestedFilename(), /^Data_Keluarga_PKPS_\d{4}-\d{2}-\d{2}\.xlsx$/);
  const file = resolve(TMP, "ekspor.xlsx");
  await download.saveAs(file);
  assert.equal(readFileSync(file).subarray(0, 2).toString(), "PK", "berkas xlsx (zip)");
  noIssues();
  await context.close();
});

test("jadwal dibuat lalu dibatalkan; aktivitas dengan foto tampil", async () => {
  const { context, page } = await authed(PENDAMPING);
  await goto(page, "/schedules/new/");
  await loaded(page);
  const title = "Kunjungan E2E " + randomBytes(2).toString("hex");
  await page.fill('[name="title"]', title);
  await page.selectOption('[name="family_id"]', shared.familyId);
  const when = new Date(Date.now() + 3 * 86400000);
  const local = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(when).replace(" ", "T");
  await page.fill('[name="scheduled_at"]', local);
  await page.getByRole("button", { name: "Buat jadwal" }).click();
  await page.waitForURL("**/schedules/");
  await loaded(page);
  const row = page.locator("tr", { hasText: title });
  await row.getByRole("button", { name: "Batalkan" }).click();
  await page.locator("dialog").getByRole("button", { name: "Batalkan jadwal" }).click();
  await page.getByText("Jadwal berhasil dibatalkan.").waitFor();

  await goto(page, "/activities/new/");
  await loaded(page);
  const act = "Aktivitas E2E " + randomBytes(2).toString("hex");
  await page.fill('[name="title"]', act);
  await page.fill('[name="description"]', "Pendampingan rutin");
  await page.selectOption('[name="family_id"]', shared.familyId);
  await page.setInputFiles('[name="photos"]', [{ name: "foto.png", mimeType: "image/png", buffer: PNG }]);
  await page.getByRole("button", { name: "Simpan aktivitas" }).click();
  await page.waitForURL("**/activities/");
  await loaded(page);
  const img = page.locator(`img[alt="Foto aktivitas ${act}"]`);
  await img.waitFor();
  assert.ok(await img.evaluate((el) => el.complete && el.naturalWidth > 0), "foto aktivitas tampil");
  noIssues();
  await context.close();
});

test("aksesibilitas terang dan gelap, tanpa luapan di 390 px", async () => {
  const pages = ["/login/", "/dashboard/", "/families/", `/families/detail/?id=${shared.familyId}`, "/families/new/", "/assessments/",
    "/donations/", "/disbursements/", "/schedules/", "/activities/", "/reports/"];
  const session = await login(ADMIN);
  for (const scheme of ["light", "dark"]) {
    const { context, page } = await newPage({ colorScheme: scheme, session });
    for (const p of pages) {
      await goto(page, p);
      if (p !== "/login/") await loaded(page);
      await axe(page, `${p} (${scheme})`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const p of pages) {
      await goto(page, p);
      if (p !== "/login/") await loaded(page);
      await noPageOverflow(page, `${p} di 390px (${scheme})`);
    }
    await context.close();
  }
  noIssues();
});

test("base path dan halaman 404", async () => {
  const { context, page } = await newPage();
  const r = await page.goto(WEB + "/tidak-ada/");
  assert.equal(r.status(), 404);
  await page.getByRole("heading", { name: "Halaman tidak ditemukan" }).waitFor();
  const href = await page.getByRole("link", { name: "Ke dasbor" }).getAttribute("href");
  assert.equal(href, BASE + "/dashboard/");
  noIssues();
  await context.close();
});
