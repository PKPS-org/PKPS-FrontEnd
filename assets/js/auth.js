import * as api from "./api.js";
import * as session from "./session.js";

// Peran yang boleh memakai situs ini. Akun keluarga memakai aplikasi mobile.
export const WEB_ROLES = ["admin", "pendamping", "donatur"];
export const FAMILY_REJECTED = "Akun keluarga menggunakan aplikasi mobile Keluarga Mandiri.";

// Memastikan ada token; bila tidak, pindah ke halaman masuk. Mengembalikan true bila lanjut.
export function requireLogin() {
  if (session.isLoggedIn()) return true;
  api.goReplace("/login/");
  return false;
}

// Halaman berperan: harus masuk dan perannya salah satu roles. Cache pengguna bisa basi, jadi bila cache
// tidak cocok, peran disegarkan dari /api/auth/me sebelum menyingkirkan pengguna. Penegakan sebenarnya
// tetap di backend (403); ini hanya agar pengguna tidak melihat kerangka halaman yang bukan untuknya.
export async function requireRole(...roles) {
  if (!requireLogin()) return false;
  let user = session.getUser();
  if (!user || !roles.includes(user.role)) {
    try { user = await loadMe(); } catch { user = null; }
  }
  if (user && roles.includes(user.role)) return true;
  if (user && user.role === "keluarga") {
    session.clear();
    api.goReplace("/login/?keluarga=1");
    return false;
  }
  api.goReplace("/dashboard/");
  return false;
}

// Halaman masuk: bila sudah punya token yang sah, langsung ke dasbor.
export async function redirectIfLoggedIn() {
  if (!session.isLoggedIn()) return false;
  try {
    const user = await loadMe();
    if (!WEB_ROLES.includes(user.role)) { session.clear(); return false; }
    api.goReplace("/dashboard/");
    return true;
  } catch {
    session.clear(); // token tidak berlaku lagi
    return false;
  }
}

// Menyimpan sesi dari respons login lalu ke dasbor. Akun keluarga ditolak di sisi klien.
export function startSession(resp) {
  const { token, user } = resp.data || {};
  if (!user || !WEB_ROLES.includes(user.role)) {
    session.clear();
    throw new api.ApiError(FAMILY_REJECTED, 403, null);
  }
  session.setSession(token, user);
  api.go("/dashboard/");
}

export async function logout() {
  try { await api.post("/api/auth/logout"); } catch { /* sisi server stateless */ }
  session.clear();
  api.go("/login/");
}

// Memuat /api/auth/me (menyegarkan cache pengguna) dan mengembalikan user.
export async function loadMe() {
  const me = await api.get("/api/auth/me");
  if (me && me.data) session.setUser(me.data);
  return me && me.data;
}
