import "../common.js";
import * as api from "../api.js";
import * as session from "../session.js";

// Akar situs tidak punya isi: yang sudah masuk ke dasbor, sisanya ke halaman masuk.
api.goReplace(session.isLoggedIn() ? "/dashboard/" : "/login/");
