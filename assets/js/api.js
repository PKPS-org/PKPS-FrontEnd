// Klien API PKPS (fetch, tanpa pustaka). Backend memakai amplop {success, message, data, meta}; 422
// membawa errors per kolom. Perilaku yang perlu diketahui:
//  - setelah mengalihkan halaman (401), mengembalikan promise yang tak pernah selesai, bukan undefined,
//    sehingga pemanggil tidak galat saat halaman berpindah
//  - 401 dari /api/auth/login TIDAK mengalihkan (itu galat biasa: sandi salah)
//  - body FormData dikirim apa adanya (multipart); PUT multipart dikirim sebagai POST dengan _method=PUT,
//    seperti aplikasi mobile, karena backend memperlakukan keduanya sama
import { config } from "./config.js";
import * as session from "./session.js";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Jalur internal yang aman: diawali satu "/" dan bukan "//" atau "/\".
export function safePath(p) {
  return typeof p === "string" && /^\/(?![/\\])/.test(p) ? p : null;
}

const NEVER = new Promise(() => {});

// Semua jalur internal ditulis relatif terhadap akar aplikasi ("/login/"); awalan situs
// (config.basePath) ditambahkan hanya di sini, saat membentuk URL atau berpindah halaman.
export function withBase(path) { return config.basePath + path; }
export function go(path) { window.location.assign(withBase(path)); }
export function goReplace(path) { window.location.replace(withBase(path)); }

function navigate(path) {
  go(path);
  return NEVER;
}

const NO_SESSION_REDIRECT = /^\/api\/auth\/login/;

async function parse(res) {
  const type = res.headers.get("Content-Type") || "";
  if (type.includes("application/json")) {
    try { return await res.json(); } catch { return null; }
  }
  return null;
}

// Pesan galat untuk pengguna: pesan backend, ditambah pesan lain dari errors 422 (semua kolom) bila ada.
function errorMessage(data, status) {
  if (!data) return `Galat ${status}`;
  const all = data.errors ? Object.values(data.errors).flat() : [];
  const extra = all.filter((m) => m !== data.message);
  return [data.message || `Galat ${status}`, ...extra].join(" ");
}

export async function request(method, path, body, opts = {}) {
  const headers = { Accept: "application/json" };
  let payload;
  let sendMethod = method;
  if (body instanceof FormData) {
    payload = body;
    if (method !== "POST") { body.set("_method", method); sendMethod = "POST"; }
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const token = session.getToken();
  if (token) headers.Authorization = "Bearer " + token;

  let res;
  try {
    res = await fetch(config.apiBase + path, { method: sendMethod, headers, body: payload });
  } catch {
    throw new ApiError("Tidak dapat menjangkau server. Periksa koneksi Anda lalu coba lagi.", 0, null);
  }
  const data = await parse(res);

  if (res.status === 401 && !NO_SESSION_REDIRECT.test(path)) {
    session.clear();
    return navigate("/login/?sesi=berakhir");
  }
  if (!res.ok) {
    const err = new ApiError(errorMessage(data, res.status), res.status, data);
    err.retryAfter = res.headers.get("Retry-After");
    throw err;
  }
  return data;
}

export const get = (path, opts) => request("GET", path, undefined, opts);
export const post = (path, body, opts) => request("POST", path, body === undefined ? {} : body, opts);
export const put = (path, body, opts) => request("PUT", path, body === undefined ? {} : body, opts);
export const patch = (path, body, opts) => request("PATCH", path, body, opts);
export const del = (path, opts) => request("DELETE", path, undefined, opts);

// Unduhan butuh header Authorization, jadi tidak bisa lewat tautan biasa: ambil sebagai blob
// lalu picu penyimpanan lewat <a download>.
export async function download(path, filename) {
  const headers = {};
  const token = session.getToken();
  if (token) headers.Authorization = "Bearer " + token;
  let res;
  try {
    res = await fetch(config.apiBase + path, { headers });
  } catch {
    throw new ApiError("Tidak dapat menjangkau server.", 0, null);
  }
  if (!res.ok) {
    const data = await parse(res);
    if (res.status === 401) { session.clear(); return navigate("/login/?sesi=berakhir"); }
    throw new ApiError(errorMessage(data, res.status), res.status, data);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Gambar dikecilkan di peramban sebelum diunggah (sisi terpanjang 1600 px, JPEG 0.8), supaya penyimpanan
// berkas (GridFS gratisan 512 MB) tidak cepat penuh. Berkas bukan gambar (PDF) dan gambar yang gagal
// diproses dikirim apa adanya.
export async function shrinkImage(file, max = 1600, quality = 0.8) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// FormData dari objek kolom (nilai kosong dilewati) dan berkas ({kolom: File | File[]}). Gambar dikecilkan dulu.
export async function formData(fields, files = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === "") continue;
    fd.append(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  for (const [k, v] of Object.entries(files)) {
    const list = Array.isArray(v) ? v : [v];
    for (const f of list) if (f) fd.append(Array.isArray(v) ? k + "[]" : k, await shrinkImage(f));
  }
  return fd;
}
