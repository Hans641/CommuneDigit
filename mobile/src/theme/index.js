// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Système de thème
//  Critères Bastien & Scapin :
//   - Guidage : couleurs sémantiques claires, contrastes WCAG AA
//   - Homogénéité : tokens partagés dans toute l'app
//   - Signifiance des codes : couleurs cohérentes (rouge=danger, vert=succès)
// ═══════════════════════════════════════════════════════════════

// ── Palette de base ────────────────────────────────────────────
const PALETTE = {
  emerald50:  '#ecfdf5',
  emerald100: '#d1fae5',
  emerald200: '#a7f3d0',
  emerald400: '#34d399',
  emerald500: '#10b981',
  emerald600: '#059669',
  emerald700: '#047857',
  emerald800: '#065f46',
  emerald900: '#064e3b',

  teal400:    '#2dd4bf',
  teal500:    '#14b8a6',

  violet400:  '#a78bfa',
  violet500:  '#8b5cf6',

  amber400:   '#fbbf24',
  amber500:   '#f59e0b',

  red400:     '#f87171',
  red500:     '#ef4444',
  red600:     '#dc2626',

  sky400:     '#38bdf8',
  sky500:     '#0ea5e9',

  slate50:    '#f8fafc',
  slate100:   '#f1f5f9',
  slate200:   '#e2e8f0',
  slate300:   '#cbd5e1',
  slate400:   '#94a3b8',
  slate500:   '#64748b',
  slate600:   '#475569',
  slate700:   '#334155',
  slate800:   '#1e293b',
  slate900:   '#0f172a',
  slate950:   '#020617',

  white: '#ffffff',
  black: '#000000',
};

// ── Thème sombre ───────────────────────────────────────────────
export const darkTheme = {
  // Fonds
  bg:           '#0a1628',       // fond principal profond
  bgCard:       '#0f2040',       // carte
  bgCardAlt:    '#142850',       // carte alternative
  bgInput:      'rgba(255,255,255,0.07)',
  bgHighlight:  'rgba(16,185,129,0.12)',

  // Surfaces glassées
  glass:        'rgba(255,255,255,0.06)',
  glassBorder:  'rgba(255,255,255,0.10)',
  glassStrong:  'rgba(255,255,255,0.12)',

  // Texte — contrastes WCAG AA garantis
  textPrimary:   '#f1f5f9',      // ≥ 4.5:1 sur bg
  textSecondary: '#94a3b8',      // ≥ 4.5:1 sur bg
  textMuted:     '#64748b',      // 3:1 (grands textes)
  textInverse:   '#064e3b',

  // Accent principal
  accent:        PALETTE.emerald500,
  accentLight:   PALETTE.emerald400,
  accentDark:    PALETTE.emerald700,
  accentBg:      'rgba(16,185,129,0.15)',

  // Sémantique
  success:       PALETTE.emerald500,
  successBg:     'rgba(16,185,129,0.12)',
  warning:       PALETTE.amber500,
  warningBg:     'rgba(245,158,11,0.12)',
  danger:        PALETTE.red500,
  dangerBg:      'rgba(239,68,68,0.12)',
  info:          PALETTE.sky500,
  infoBg:        'rgba(14,165,233,0.12)',

  // Navigation bas
  navBg:         '#0a1628',
  navBorder:     'rgba(255,255,255,0.08)',
  navActive:     PALETTE.emerald500,
  navInactive:   '#475569',

  // Bordures
  border:        'rgba(255,255,255,0.08)',
  borderStrong:  'rgba(255,255,255,0.16)',

  // Ombres
  shadowColor:   '#000000',
  shadowOpacity: 0.4,

  isDark: true,
};

// ── Thème clair ────────────────────────────────────────────────
export const lightTheme = {
  // Fonds
  bg:           '#f0fdf9',       // fond vert très pâle
  bgCard:       '#ffffff',
  bgCardAlt:    '#f8fffe',
  bgInput:      'rgba(6,78,59,0.04)',
  bgHighlight:  'rgba(16,185,129,0.08)',

  // Surfaces
  glass:        'rgba(255,255,255,0.80)',
  glassBorder:  'rgba(6,78,59,0.12)',
  glassStrong:  'rgba(255,255,255,0.95)',

  // Texte — contrastes WCAG AA garantis
  textPrimary:   '#064e3b',      // ≥ 7:1 sur fond clair
  textSecondary: '#047857',      // ≥ 4.5:1
  textMuted:     '#6b7280',      // 3.5:1 (grands textes)
  textInverse:   '#ffffff',

  // Accent
  accent:        PALETTE.emerald600,
  accentLight:   PALETTE.emerald500,
  accentDark:    PALETTE.emerald800,
  accentBg:      'rgba(16,185,129,0.10)',

  // Sémantique
  success:       PALETTE.emerald600,
  successBg:     'rgba(16,185,129,0.10)',
  warning:       '#d97706',
  warningBg:     'rgba(217,119,6,0.10)',
  danger:        PALETTE.red600,
  dangerBg:      'rgba(220,38,38,0.08)',
  info:          PALETTE.sky500,
  infoBg:        'rgba(14,165,233,0.08)',

  // Navigation bas
  navBg:         '#ffffff',
  navBorder:     'rgba(6,78,59,0.10)',
  navActive:     PALETTE.emerald600,
  navInactive:   '#9ca3af',

  // Bordures
  border:        'rgba(6,78,59,0.10)',
  borderStrong:  'rgba(6,78,59,0.20)',

  // Ombres
  shadowColor:   '#064e3b',
  shadowOpacity: 0.08,

  isDark: false,
};

// ── Typographie — Bastien & Scapin : Lisibilité ────────────────
// Tailles minimales : 14sp (corps), 12sp (secondaire), jamais < 11sp
export const typography = {
  // Display
  display:   { fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  h1:        { fontSize: 24, fontWeight: '700', lineHeight: 30, letterSpacing: -0.3 },
  h2:        { fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.2 },
  h3:        { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  h4:        { fontSize: 15, fontWeight: '600', lineHeight: 20 },

  // Corps — minimum 14sp pour lisibilité mobile
  bodyLg:    { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body:      { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  bodySm:    { fontSize: 13, fontWeight: '400', lineHeight: 19 },

  // UI
  label:     { fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' },
  caption:   { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  overline:  { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },

  // Navigation bas — assez grand pour zone tactile
  navLabel:  { fontSize: 11, fontWeight: '500', lineHeight: 14 },

  // Bouton — lisible, gras
  btnLg:     { fontSize: 16, fontWeight: '700', lineHeight: 20 },
  btn:       { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  btnSm:     { fontSize: 13, fontWeight: '600', lineHeight: 16 },
};

// ── Espacement — grille de 4px ─────────────────────────────────
export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
};

// ── Rayons de bordure ──────────────────────────────────────────
export const radius = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 999,
};

// ── Zones tactiles — Bastien & Scapin : Contrôle explicite ────
// Taille minimale des cibles : 44×44pt (recommandation Apple/Google)
export const touchTarget = {
  min:    44,
  medium: 52,
  large:  56,
};

// ── Ombres ─────────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  lg: {
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
  },
  xl: {
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 40,
    elevation: 20,
  },
};
