/**
 * CommuneDigit — Service API centralisé
 * Connecté au backend FastAPI sur /api
 */
import axios from 'axios';

// ── URL du backend ────────────────────────────────────────────────
// En développement : http://localhost:8000/api
// En production    : remplacer par l'URL du serveur déployé (ou variable d'env Vite)
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ── Instance Axios ────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Intercepteur : injecte le token JWT ──────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cd_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Intercepteur : gère les 401 (token expiré) ───────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cd_token');
      localStorage.removeItem('cd_user');
      window.dispatchEvent(new Event('cd:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────────
export const authAPI = {
  login: async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { access_token, user } = res.data;
    localStorage.setItem('cd_token', access_token);
    localStorage.setItem('cd_user', JSON.stringify(user));
    return { access_token, user };
  },
  me: async () => (await api.get('/auth/me')).data,
  logout: () => {
    localStorage.removeItem('cd_token');
    localStorage.removeItem('cd_user');
  },
};

// ── Dashboard ────────────────────────────────────────────────────
export const dashboardAPI = {
  stats: async () => (await api.get('/dashboard/stats')).data,
};

// ── Citoyens ─────────────────────────────────────────────────────
export const citoyensAPI = {
  list:   async (params = {}) => (await api.get('/citoyens', { params })).data,
  create: async (data)        => (await api.post('/citoyens', data)).data,
  update: async (id, data)    => (await api.patch(`/citoyens/${id}`, data)).data,
  delete: async (id)          => { await api.delete(`/citoyens/${id}`); },
};

// ── Actes ────────────────────────────────────────────────────────
export const actesAPI = {
  list:   async (params = {}) => (await api.get('/actes', { params })).data,
  create: async (data)        => (await api.post('/actes', data)).data,
  update: async (id, data)    => (await api.patch(`/actes/${id}`, data)).data,
};

// ── Transactions ─────────────────────────────────────────────────
export const transactionsAPI = {
  list:       async (params = {}) => (await api.get('/transactions', { params })).data,
  create:     async (data)        => (await api.post('/transactions', data)).data,
  totalTaxes: async ()            => (await api.get('/transactions/stats/total')).data,
};

// ── Certificats ──────────────────────────────────────────────────
export const certificatsAPI = {
  list:     async (params = {}) => (await api.get('/certificats', { params })).data,
  create:   async (data)        => (await api.post('/certificats', data)).data,
  update:   async (id, data)    => (await api.patch(`/certificats/${id}`, data)).data,
  delivrer: async (id)          => (await api.post(`/certificats/${id}/delivrer`)).data,
};

// ── Alertes ──────────────────────────────────────────────────────
export const alertesAPI = {
  list:       async (params = {}) => (await api.get('/alertes', { params })).data,
  create:     async (data)        => (await api.post('/alertes', data)).data,
  desactiver: async (id)          => { await api.patch(`/alertes/${id}/desactiver`); },
};

// ── Agents ───────────────────────────────────────────────────────
export const agentsAPI = {
  list:    async (params = {}) => (await api.get('/agents', { params })).data,
  create:  async (data)        => (await api.post('/agents', data)).data,
  update:  async (id, data)    => (await api.patch(`/agents/${id}`, data)).data,
  disable: async (id)          => { await api.delete(`/agents/${id}`); },
};

// ── Fokontany ────────────────────────────────────────────────────
export const fokontanyAPI = {
  list: async () => (await api.get('/fokontany')).data,
};

// ── Audit ────────────────────────────────────────────────────────
export const auditAPI = {
  list: async (params = {}) => (await api.get('/audit', { params })).data,
};

// ── Public (sans auth) ───────────────────────────────────────────
export const publicAPI = {
  soumettreDemande: async (data)        => (await api.post('/public/demandes', data)).data,
  suivreDemande:    async (reference)   => (await api.get(`/public/demandes/${reference}`)).data,
};

export default api;

// ══════════════════════════════════════════════════════════════════
//  ESPACE CITOYEN — auth et services séparés
// ══════════════════════════════════════════════════════════════════

const CITOYEN_PREFIX = `${BASE_URL}/espace-citoyen`;

const citoyenHeaders = () => {
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('cd_citoyen_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

const citoyenReq = async (method, path, body = null) => {
  const opts = { method, headers: citoyenHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${CITOYEN_PREFIX}${path}`, opts);
  if (res.status === 401) {
    localStorage.removeItem('cd_citoyen_token');
    localStorage.removeItem('cd_citoyen');
    window.dispatchEvent(new Event('cd:citoyen_unauthorized'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(err.detail || 'Erreur'), { status: res.status, data: err });
  }
  if (res.status === 204) return null;
  return res.json();
};

export const citoyenAuthAPI = {
  inscription: async (data) => {
    const res = await citoyenReq('POST', '/inscription', data);
    localStorage.setItem('cd_citoyen_token', res.access_token);
    localStorage.setItem('cd_citoyen', JSON.stringify(res.compte));
    return res;
  },
  login: async (email, password) => {
    const res = await citoyenReq('POST', '/login', { email, password });
    localStorage.setItem('cd_citoyen_token', res.access_token);
    localStorage.setItem('cd_citoyen', JSON.stringify(res.compte));
    return res;
  },
  logout: () => {
    localStorage.removeItem('cd_citoyen_token');
    localStorage.removeItem('cd_citoyen');
  },
  profil: () => citoyenReq('GET', '/profil'),
  updateProfil: (data) => citoyenReq('PATCH', '/profil', data),
};

export const citoyenEspaceAPI = {
  projets:    (params = {}) => citoyenReq('GET', '/projets'),
  alertes:    ()             => citoyenReq('GET', '/alertes'),
  fokontany:  ()             => citoyenReq('GET', '/fokontany'),
  catalogue:  (categorie)    => citoyenReq('GET', categorie ? `/catalogue?categorie=${encodeURIComponent(categorie)}` : '/catalogue'),
  getService: (code)         => citoyenReq('GET', `/catalogue/${code}`),
  mesDemandes:()             => citoyenReq('GET', '/demandes'),
  getDemande: (id)           => citoyenReq('GET', `/demandes/${id}`),
  soumettre:  (data)         => citoyenReq('POST', '/demandes', data),
  payer:      (id, data)     => citoyenReq('POST', `/demandes/${id}/payer`, data),
};

// ── Demandes citoyens (côté agent) ──────────────────────────────
export const demandesCitoyensAPI = {
  list:    (params = {}) => api.get('/demandes-citoyens', { params }).then(r => r.data),
  stats:   ()            => api.get('/demandes-citoyens/stats').then(r => r.data),
  traiter: (id, body)    => api.patch(`/demandes-citoyens/${id}`, body).then(r => r.data),
};
