// Label dan lencana domain PKPS (sama dengan label tampilan Laravel dan aplikasi mobile).
import { badge } from "./ui.js";

export const WELFARE = { pra_sejahtera: "Pra-Sejahtera", sejahtera_1: "Sejahtera I", sejahtera_2: "Sejahtera II" };
export const HOUSING = { own: "Milik sendiri", rent: "Sewa", free: "Menumpang", other: "Lainnya" };
export const GENDER = { male: "Laki-laki", female: "Perempuan" };
export const RELATIONSHIP = { head: "Kepala keluarga", spouse: "Pasangan", child: "Anak", parent: "Orang tua", other: "Lainnya" };
export const NEED_CATEGORY = { pangan: "Pangan", sandang: "Sandang", papan: "Papan", pendidikan: "Pendidikan", kesehatan: "Kesehatan", ekonomi: "Ekonomi", lainnya: "Lainnya" };
export const NEED_PRIORITY = { low: "Rendah", medium: "Sedang", high: "Tinggi", urgent: "Mendesak" };
export const NEED_STATUS = { pending: "Menunggu", verified: "Terverifikasi", fulfilled: "Terpenuhi", rejected: "Ditolak" };
export const PERIOD = { bulanan: "Bulanan", triwulan: "Triwulan", semesteran: "Semesteran", tahunan: "Tahunan" };
export const ASSESSMENT_CATEGORY = { sangat_rendah: "Sangat rendah", rendah: "Rendah", cukup: "Cukup", baik: "Baik", sangat_baik: "Sangat baik" };
export const SCORE_DIMENSIONS = { ekonomi: "Ekonomi", kesehatan: "Kesehatan", pendidikan: "Pendidikan", hunian: "Hunian", sosial: "Sosial" };
export const AID_TYPE = { uang: "Uang", barang: "Barang", jasa: "Jasa" };
export const DONATION_STATUS = { pending: "Menunggu", confirmed: "Terkonfirmasi", cancelled: "Dibatalkan" };
export const SCHEDULE_TYPE = { kunjungan: "Kunjungan", pelatihan: "Pelatihan", rapat: "Rapat", distribusi: "Distribusi", lainnya: "Lainnya" };
export const SCHEDULE_STATUS = { scheduled: "Terjadwal", ongoing: "Berlangsung", completed: "Selesai", cancelled: "Dibatalkan" };
export const ACTIVITY_CATEGORY = { kunjungan: "Kunjungan", pelatihan: "Pelatihan", konseling: "Konseling", distribusi: "Distribusi", monitoring: "Monitoring", lainnya: "Lainnya" };
export const REPORT_TYPE = { bulanan: "Bulanan", triwulan: "Triwulan", semesteran: "Semesteran", tahunan: "Tahunan", custom: "Rentang khusus" };

export const label = (map, key) => map[key] || key || "—";
export const options = (map) => Object.entries(map);

export function welfareBadge(s) {
  return badge(label(WELFARE, s), { pra_sejahtera: "danger", sejahtera_1: "pending", sejahtera_2: "ok" }[s] || "neutral");
}
export function needBadge(s) {
  return badge(label(NEED_STATUS, s), { pending: "pending", verified: "trial", fulfilled: "ok", rejected: "danger" }[s] || "neutral");
}
export function donationBadge(s) {
  return badge(label(DONATION_STATUS, s), { pending: "pending", confirmed: "ok", cancelled: "danger" }[s] || "neutral");
}
export function scheduleBadge(s) {
  return badge(label(SCHEDULE_STATUS, s), { scheduled: "trial", ongoing: "pending", completed: "ok", cancelled: "danger" }[s] || "neutral");
}
export function categoryBadge(c) {
  return badge(label(ASSESSMENT_CATEGORY, c), { sangat_rendah: "danger", rendah: "danger", cukup: "pending", baik: "trial", sangat_baik: "ok" }[c] || "neutral");
}
