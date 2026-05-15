// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Composants UI réutilisables
//  Bastien & Scapin :
//   - Guidage : feedback visuel immédiat sur chaque interaction
//   - Contrôle explicite : boutons bien délimités, zones tactiles ≥ 44pt
//   - Compatibilité : composants cohérents avec les conventions mobiles
// ═══════════════════════════════════════════════════════════════
import React from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useTheme } from '../context/AppContext';
import { typography, spacing, radius, touchTarget, shadows } from '../theme';

// ── Badge de statut ────────────────────────────────────────────
export function StatusBadge({ status, label }) {
  const { theme } = useTheme();

  const configs = {
    valide:     { bg: theme.successBg, color: theme.success,  dot: theme.success  },
    en_cours:   { bg: theme.infoBg,    color: theme.info,     dot: theme.info     },
    en_attente: { bg: theme.warningBg, color: theme.warning,  dot: theme.warning  },
    rejete:     { bg: theme.dangerBg,  color: theme.danger,   dot: theme.danger   },
  };
  const cfg = configs[status] || configs.en_attente;

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: cfg.dot }]} />
      <Text style={[typography.caption, { color: cfg.color, fontWeight: '600' }]}>
        {label}
      </Text>
    </View>
  );
}

// ── Bouton principal ───────────────────────────────────────────
export function Button({ label, onPress, variant = 'primary', icon, loading, disabled, style }) {
  const { theme } = useTheme();

  const variants = {
    primary: {
      bg: theme.accent,
      color: '#fff',
      border: 'transparent',
    },
    secondary: {
      bg: theme.accentBg,
      color: theme.accent,
      border: theme.accent,
    },
    ghost: {
      bg: 'transparent',
      color: theme.textSecondary,
      border: theme.border,
    },
    danger: {
      bg: theme.dangerBg,
      color: theme.danger,
      border: theme.danger,
    },
  };
  const v = variants[variant] || variants.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.btn,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: variant === 'ghost' || variant === 'secondary' ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
          ...shadows.sm,
          shadowColor: theme.shadowColor,
          shadowOpacity: theme.shadowOpacity,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.color} size="small" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={[typography.btn, { color: v.color }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Champ de saisie ────────────────────────────────────────────
export function Input({ label, value, onChangeText, placeholder, secureTextEntry, icon, error, multiline }) {
  const { theme } = useTheme();

  return (
    <View style={{ marginBottom: spacing.lg }}>
      {label && (
        <Text style={[typography.label, { color: theme.textMuted, marginBottom: spacing.sm }]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.inputWrap,
        {
          backgroundColor: theme.bgInput,
          borderColor: error ? theme.danger : theme.border,
          borderWidth: 1,
        },
      ]}>
        {icon && <View style={{ marginRight: spacing.sm }}>{icon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          style={[
            typography.body,
            {
              color: theme.textPrimary,
              flex: 1,
              paddingVertical: 0,
              minHeight: multiline ? 80 : undefined,
            },
          ]}
        />
      </View>
      {error && (
        <Text style={[typography.caption, { color: theme.danger, marginTop: spacing.xs }]}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ── Carte glass ────────────────────────────────────────────────
export function Card({ children, style, onPress, padding = spacing.lg }) {
  const { theme } = useTheme();

  const cardStyle = [
    styles.card,
    {
      backgroundColor: theme.bgCard,
      borderColor: theme.border,
      padding,
      ...shadows.md,
      shadowColor: theme.shadowColor,
      shadowOpacity: theme.shadowOpacity,
    },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

// ── Stat card ──────────────────────────────────────────────────
export function StatCard({ icon: Icon, value, label, trend, trendUp, color, onPress }) {
  const { theme } = useTheme();

  return (
    <Card onPress={onPress} padding={spacing.lg} style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
          <Icon size={18} color={color} />
        </View>
        {trend && (
          <View style={[styles.trendBadge, { backgroundColor: trendUp ? theme.successBg : theme.dangerBg }]}>
            <Text style={[typography.overline, { color: trendUp ? theme.success : theme.danger }]}>
              {trend}
            </Text>
          </View>
        )}
      </View>
      <Text style={[typography.h2, { color: theme.textPrimary, marginBottom: 2 }]}>{value}</Text>
      <Text style={[typography.caption, { color: theme.textMuted }]}>{label}</Text>
    </Card>
  );
}

// ── Séparateur ────────────────────────────────────────────────
export function Divider({ style }) {
  const { theme } = useTheme();
  return <View style={[{ height: 1, backgroundColor: theme.border }, style]} />;
}

// ── En-tête de section ────────────────────────────────────────
export function SectionHeader({ title, action, onAction }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[typography.h4, { color: theme.textPrimary }]}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[typography.bodySm, { color: theme.accent, fontWeight: '600' }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Chip de filtre ────────────────────────────────────────────
export function FilterChip({ label, active, onPress }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.accent : theme.glass,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text style={[typography.btnSm, { color: active ? '#fff' : theme.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Ligne de liste ────────────────────────────────────────────
export function ListRow({ left, title, subtitle, right, onPress, style }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.listRow, { borderBottomColor: theme.border }, style]}
    >
      {left && <View style={{ marginRight: spacing.md }}>{left}</View>}
      <View style={{ flex: 1 }}>
        <Text style={[typography.body, { color: theme.textPrimary, fontWeight: '500' }]}>{title}</Text>
        {subtitle && (
          <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        )}
      </View>
      {right && <View style={{ marginLeft: spacing.sm }}>{right}</View>}
    </TouchableOpacity>
  );
}

// ── Avatar ────────────────────────────────────────────────────
export function Avatar({ initials, size = 40, color }) {
  const { theme } = useTheme();
  return (
    <View style={[
      styles.avatar,
      {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color || theme.accentBg,
      },
    ]}>
      <Text style={[typography.h4, { color: color ? '#fff' : theme.accent, fontSize: size * 0.36 }]}>
        {initials}
      </Text>
    </View>
  );
}

// ── Toast / Alerte inline ─────────────────────────────────────
export function AlertBanner({ type = 'info', message }) {
  const { theme } = useTheme();
  const configs = {
    success: { bg: theme.successBg, color: theme.success, icon: '✓' },
    warning: { bg: theme.warningBg, color: theme.warning, icon: '⚠' },
    error:   { bg: theme.dangerBg,  color: theme.danger,  icon: '✕' },
    info:    { bg: theme.infoBg,    color: theme.info,    icon: 'ℹ' },
  };
  const cfg = configs[type];
  return (
    <View style={[styles.alertBanner, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
      <Text style={[typography.body, { color: cfg.color, fontWeight: '600' }]}>{cfg.icon}  {message}</Text>
    </View>
  );
}

// ── Styles internes ───────────────────────────────────────────
const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    minHeight: touchTarget.min, paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: touchTarget.min, paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },

  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
  },

  iconWrap: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  trendBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.full,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },

  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1,
    marginRight: spacing.sm,
  },

  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: touchTarget.min,
  },

  avatar: {
    alignItems: 'center', justifyContent: 'center',
  },

  alertBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
});
