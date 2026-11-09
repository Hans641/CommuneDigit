/**
 * CommuneDigit Mobile — Service API
 * Connecté au backend FastAPI (même que le frontend web)
 */

// ── URL du backend ────────────────────────────────────────────────
// En dev Android emulateur : http://10.0.2.2:8000/api
// En dev iOS simulator    : http://localhost:8000/api  (ou http://127.0.0.1:8000/api)
// En production           : remplacer par l'URL du serveur
let BASE_URL = "http://10.0.2.2:8000/api"; // Android emulateur par défaut

let _token = null;

// ── Helpers ───────────────────────────────────────────────────────
const headers = () => {
  const h = { "Content-Type": "application/json" };
  if (_token) h["Authorization"] = `Bearer ${_token}`;
  return h;
};

export function normalizeBackend(input) {
  const url = new URL(input.trim());
  const development = typeof __DEV__ !== "undefined" && __DEV__;
  if (
    (!development && url.protocol !== "https:") ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Adresse HTTPS du serveur requise");
  return url.toString().replace(/\/$/, "");
}
export const setBackendUrl = (value) => {
  BASE_URL = normalizeBackend(value);
};
export const getBackendUrl = () => BASE_URL;

async function requestAt(base, token, method, path, body = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const opts = {
      method,
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(base + path, opts);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw Object.assign(
        new Error(
          typeof error.detail === "string" ? error.detail : "Requête refusée",
        ),
        { status: res.status },
      );
    }
    return res.status === 204 ? null : res.json();
  } catch (error) {
    if (error.status) throw error;
    throw new Error(
      "Serveur injoignable ; vos saisies locales sont conservées.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
const request = (method, path, body = null) =>
  requestAt(BASE_URL, _token, method, path, body);

// Each sync owner captures its own token and endpoint; account changes cannot borrow them.
export function createSyncAPI(base, token) {
  base = normalizeBackend(base);
  return {
    me: () => requestAt(base, token, "GET", "/auth/me"),
    fokontany: () => requestAt(base, token, "GET", "/fokontany"),
    push: (records) => requestAt(base, token, "POST", "/sync/", { records }),
    pull: (type, cursor = null, limit = 100) => {
      const params = new URLSearchParams(
        Object.entries({ ...cursor, limit }).filter(
          ([, v]) => v !== null && v !== undefined,
        ),
      );
      return requestAt(base, token, "GET", `/sync/${type}?${params}`);
    },
  };
}

// ── Auth ─────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * Connexion — POST /api/auth/login
   * Retourne { access_token, user }
   */
  login: async (username, password) => {
    const data = await request("POST", "/auth/login", { username, password });
    _token = data.access_token;
    return data;
  },

  /** Profil courant — GET /api/auth/me */
  me: async () => request("GET", "/auth/me"),

  /** Déconnexion locale */
  logout: () => {
    _token = null;
  },

  /** Setter manuel du token (utile après rechargement) */
  setToken: (token) => {
    _token = token;
  },
};

// ── Dashboard ────────────────────────────────────────────────────
export const dashboardAPI = {
  stats: () => request("GET", "/dashboard/stats"),
};

// ── Citoyens ─────────────────────────────────────────────────────
export const citoyensAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
    ).toString();
    return request("GET", `/citoyens${qs ? "?" + qs : ""}`);
  },
  create: (data) => request("POST", "/citoyens", data),
  update: (id, data) => request("PATCH", `/citoyens/${id}`, data),
};

// ── Actes ────────────────────────────────────────────────────────
export const actesAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ).toString();
    return request("GET", `/actes${qs ? "?" + qs : ""}`);
  },
  create: (data) => request("POST", "/actes", data),
};

// ── Transactions ─────────────────────────────────────────────────
export const transactionsAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ).toString();
    return request("GET", `/transactions${qs ? "?" + qs : ""}`);
  },
  create: (data) => request("POST", "/transactions", data),
};

// ── Certificats ──────────────────────────────────────────────────
export const certificatsAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ).toString();
    return request("GET", `/certificats${qs ? "?" + qs : ""}`);
  },
};

// ── Alertes ──────────────────────────────────────────────────────
export const alertesAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined),
    ).toString();
    return request("GET", `/alertes${qs ? "?" + qs : ""}`);
  },
};

// ── Fokontany ────────────────────────────────────────────────────
export const fokontanyAPI = {
  list: () => request("GET", "/fokontany"),
};

// ── Public (sans auth) ───────────────────────────────────────────
export const publicAPI = {
  soumettreDemande: (data) => request("POST", "/public/demandes", data),
  suivreDemande: (ref) => request("GET", `/public/demandes/${ref}`),
};

export default {
  authAPI,
  dashboardAPI,
  citoyensAPI,
  actesAPI,
  transactionsAPI,
  certificatsAPI,
  alertesAPI,
  fokontanyAPI,
  publicAPI,
};
