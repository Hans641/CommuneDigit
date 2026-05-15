/**
 * CommuneDigit Mobile — Service API
 * Connecté au backend FastAPI (même que le frontend web)
 */

// ── URL du backend ────────────────────────────────────────────────
// En dev Android emulateur : http://10.0.2.2:8000/api
// En dev iOS simulator    : http://localhost:8000/api  (ou http://127.0.0.1:8000/api)
// En production           : remplacer par l'URL du serveur
const BASE_URL = 'http://10.0.2.2:8000/api'; // Android emulateur par défaut

let _token = null;

// ── Helpers ───────────────────────────────────────────────────────
const headers = () => {
  const h = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  return h;
};

const request = async (method, path, body = null) => {
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.detail || 'Erreur réseau'), { status: res.status });
  }
  if (res.status === 204) return null;
  return res.json();
};

// ── Auth ─────────────────────────────────────────────────────────
export const authAPI = {
  /**
   * Connexion — POST /api/auth/login
   * Retourne { access_token, user }
   */
  login: async (username, password) => {
    const data = await request('POST', '/auth/login', { username, password });
    _token = data.access_token;
    return data;
  },

  /** Profil courant — GET /api/auth/me */
  me: async () => request('GET', '/auth/me'),

  /** Déconnexion locale */
  logout: () => { _token = null; },

  /** Setter manuel du token (utile après rechargement) */
  setToken: (token) => { _token = token; },
};

// ── Dashboard ────────────────────────────────────────────────────
export const dashboardAPI = {
  stats: () => request('GET', '/dashboard/stats'),
};

// ── Citoyens ─────────────────────────────────────────────────────
export const citoyensAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString();
    return request('GET', `/citoyens${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('POST', '/citoyens', data),
  update: (id, data) => request('PATCH', `/citoyens/${id}`, data),
};

// ── Actes ────────────────────────────────────────────────────────
export const actesAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString();
    return request('GET', `/actes${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('POST', '/actes', data),
};

// ── Transactions ─────────────────────────────────────────────────
export const transactionsAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString();
    return request('GET', `/transactions${qs ? '?' + qs : ''}`);
  },
  create: (data) => request('POST', '/transactions', data),
};

// ── Certificats ──────────────────────────────────────────────────
export const certificatsAPI = {
  list:   (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString();
    return request('GET', `/certificats${qs ? '?' + qs : ''}`);
  },
};

// ── Alertes ──────────────────────────────────────────────────────
export const alertesAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined)).toString();
    return request('GET', `/alertes${qs ? '?' + qs : ''}`);
  },
};

// ── Fokontany ────────────────────────────────────────────────────
export const fokontanyAPI = {
  list: () => request('GET', '/fokontany'),
};

// ── Public (sans auth) ───────────────────────────────────────────
export const publicAPI = {
  soumettreDemande: (data) => request('POST', '/public/demandes', data),
  suivreDemande:    (ref)  => request('GET', `/public/demandes/${ref}`),
};

export default { authAPI, dashboardAPI, citoyensAPI, actesAPI, transactionsAPI, certificatsAPI, alertesAPI, fokontanyAPI, publicAPI };
