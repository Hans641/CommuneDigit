// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Écran Accueil (Dashboard)
//  Bastien & Scapin :
//   - Guidage : KPI au-dessus, actions rapides accessibles en 1 tap
//   - Compatibilité : structure familière (tableau de bord)
//   - Charge de travail : info densifiée mais aérée, scrollable
//   - Signifiance : icônes + labels sur chaque action
// ═══════════════════════════════════════════════════════════════
import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, StatusBar, FlatList,
} from 'react-native';
import {
  Baby, FileText, CreditCard, Printer,
  Radio, BarChart3, Bell, RefreshCw,
  TrendingUp, TrendingDown, Clock, CheckCircle2,
  AlertCircle, ChevronRight,
} from 'lucide-react-native';
import { useTheme, useAuth, useLang } from '../context/AppContext';
import { Card, StatCard, SectionHeader, StatusBadge, Avatar } from '../components/UIKit';
import { typography, spacing, radius, shadows } from '../theme';
import { dashboardAPI, actesAPI } from '../services/api';

// Données statiques de structure (valeurs réelles viennent de l'API)
const QUICK_ACTIONS = [
  { id: 'naissance', labelKey: 'nouvNaissance', icon: Baby,      color: '#10b981', tab: 'dossiers' },
  { id: 'cert',      labelKey: 'delivreCert',   icon: FileText,  color: '#14b8a6', tab: 'dossiers' },
  { id: 'paiement',  labelKey: 'encaissement',  icon: CreditCard,color: '#8b5cf6', tab: 'paiements' },
  { id: 'imprimer',  labelKey: 'imprimer',      icon: Printer,   color: '#f59e0b', tab: 'dossiers' },
  { id: 'alerte',    labelKey: 'alertes',       icon: Radio,     color: '#ef4444', tab: 'accueil' },
  { id: 'stats',     labelKey: 'statistiques',  icon: BarChart3, color: '#0ea5e9', tab: 'dossiers' },
];

// ── Composant action rapide ────────────────────────────────────
function QuickActionBtn({ action, onPress, tr }) {
  const { theme } = useTheme();
  const Icon = action.icon;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, tension: 300, friction: 10 }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }),
    ]).start();
    onPress(action.tab);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.qaWrap}>
      <Animated.View style={[
        styles.qaIcon,
        { backgroundColor: action.color + '18', transform: [{ scale }] },
      ]}>
        <Icon size={24} color={action.color} strokeWidth={2} />
      </Animated.View>
      <Text style={[typography.caption, { color: theme.textSecondary, textAlign: 'center', marginTop: 6 }]} numberOfLines={2}>
        {tr('accueil', action.labelKey)}
      </Text>
    </TouchableOpacity>
  );
}

// ── Écran principal ────────────────────────────────────────────
export default function HomeScreen({ onNavigate }) {
  const { theme, isDark } = useTheme();
  const { tr, lang }      = useLang();
  const { user }          = useAuth();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // ── Données réelles depuis l'API ──────────────────────────────
  const [apiStats,     setApiStats]     = useState(null);
  const [recentActes,  setRecentActes]  = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadData = async () => {
    setLoadingStats(true);
    try {
      const [stats, actes] = await Promise.allSettled([
        dashboardAPI.stats(),
        actesAPI.list({ limit: 4 }),
      ]);
      if (stats.status === 'fulfilled')  setApiStats(stats.value);
      if (actes.status === 'fulfilled')  setRecentActes(actes.value);
    } catch {}
    setLoadingStats(false);
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: 100, useNativeDriver: true }),
    ]).start();
    loadData();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12
    ? tr('accueil', 'bonjourMatin')
    : hour < 18
      ? tr('accueil', 'bonjourAprem')
      : tr('accueil', 'bonsoir');

  const fmt = (n) => {
    if (n === null || n === undefined) return '…';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000)    return n.toLocaleString('fr-FR');
    return String(n);
  };

  const STATS = [
    { key: 'citoyens', value: fmt(apiStats?.total_citoyens),      up: true,  color: '#10b981' },
    { key: 'demandes', value: fmt(apiStats?.actes_ce_mois),        up: true,  color: '#14b8a6' },
    { key: 'attente',  value: fmt(apiStats?.dossiers_en_attente),  up: false, color: '#f59e0b' },
    { key: 'taxes',    value: fmt(apiStats?.total_taxes),          up: true,  color: '#8b5cf6' },
  ];

  const statLabels = {
    fr: ['Citoyens inscrits', 'Actes ce mois', 'En attente', 'Taxes (Ar)'],
    mg: ['Olom-pirenena', 'Taratasy', 'Miandry', 'Hetra (Ar)'],
  };
  const statIcons = [null, null, null, null];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── En-tête ── */}
        <Animated.View style={[
          styles.header,
          { backgroundColor: theme.bgCard, borderBottomColor: theme.border },
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          {/* Dégradé décoratif */}
          <View style={[styles.headerGradient, { backgroundColor: theme.accentBg }]} />

          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: theme.textMuted }]}>
                {greeting},
              </Text>
              <Text style={[typography.h2, { color: theme.textPrimary }]} numberOfLines={1}>
                {user?.name ?? 'Agent'}
              </Text>
              <Text style={[typography.bodySm, { color: theme.textMuted, marginTop: 2 }]}>
                {user?.role} · {user?.fokontany}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Synchro indicator */}
              <View style={[styles.syncBadge, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
                <RefreshCw size={11} color={theme.success} />
                <Text style={[typography.overline, { color: theme.success, marginLeft: 4 }]}>
                  {tr('common', 'synchro')}
                </Text>
              </View>

              {/* Bell avec badge */}
              <TouchableOpacity style={[styles.bellBtn, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}>
                <Bell size={20} color={theme.textSecondary} />
                <View style={[styles.bellBadge, { backgroundColor: theme.danger }]}>
                  <Text style={styles.bellBadgeText}>3</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Fokontany pill */}
          <View style={[styles.fokoPill, { backgroundColor: theme.accentBg, borderColor: theme.accent + '40' }]}>
            <Text style={[typography.overline, { color: theme.accent }]}>
              📍 {user?.fokontany ?? 'Fokontany'}
            </Text>
          </View>
        </Animated.View>

        <View style={{ padding: spacing.lg }}>

          {/* ── KPI Stats 2×2 ── */}
          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.statsGrid}>
              {STATS.map((s, i) => {
                const icons = [Baby, FileText, Clock, CreditCard];
                const Icon = icons[i];
                return (
                  <StatCard
                    key={s.key}
                    icon={Icon}
                    value={s.value}
                    label={statLabels[lang][i]}
                    trend={s.trendKey}
                    trendUp={s.up}
                    color={s.color}
                    onPress={() => onNavigate(i === 2 ? 'dossiers' : i === 3 ? 'paiements' : 'citoyens')}
                  />
                );
              })}
            </View>
          </Animated.View>

          {/* ── Actions rapides ── */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader title={tr('accueil', 'actionsRapides')} />
            <View style={[styles.qaContainer, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <View style={styles.qaRow}>
                {QUICK_ACTIONS.slice(0, 3).map(a => (
                  <QuickActionBtn key={a.id} action={a} onPress={onNavigate} tr={tr} />
                ))}
              </View>
              <View style={[styles.qaDivider, { backgroundColor: theme.border }]} />
              <View style={styles.qaRow}>
                {QUICK_ACTIONS.slice(3).map(a => (
                  <QuickActionBtn key={a.id} action={a} onPress={onNavigate} tr={tr} />
                ))}
              </View>
            </View>
          </View>

          {/* ── Activité récente ── */}
          <View style={{ marginTop: spacing.xl }}>
            <SectionHeader
              title={tr('accueil', 'activiteRecente')}
              action={tr('common', 'voirTout')}
              onAction={() => onNavigate('dossiers')}
            />
            <Card padding={0} style={{ overflow: 'hidden' }}>
              {ACTIVITY.map((item, index) => {
                const Icon = item.icon;
                const statusLabels = {
                  valide:    tr('common', 'valide'),
                  en_cours:  tr('common', 'enCours'),
                  en_attente:tr('common', 'enAttente'),
                };
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    style={[
                      styles.activityRow,
                      {
                        borderBottomColor: theme.border,
                        borderBottomWidth: index < ACTIVITY.length - 1 ? StyleSheet.hairlineWidth : 0,
                      },
                    ]}
                  >
                    <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
                      <Icon size={18} color={item.color} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[typography.bodySm, { color: theme.textPrimary, fontWeight: '500' }]} numberOfLines={1}>
                        {lang === 'mg' ? item.mg : item.fr}
                      </Text>
                      <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>
                        {lang === 'mg' ? `${item.time} lasa` : `il y a ${item.time}`}
                      </Text>
                    </View>
                    <StatusBadge status={item.status} label={statusLabels[item.status]} />
                  </TouchableOpacity>
                );
              })}
            </Card>
          </View>

          {/* ── Alertes rapides ── */}
          <View style={{ marginTop: spacing.xl }}>
            <TouchableOpacity
              style={[styles.alertCard, { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' }]}
              activeOpacity={0.8}
            >
              <AlertCircle size={20} color={theme.danger} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.body, { color: theme.danger, fontWeight: '700' }]}>
                  {lang === 'mg' ? '2 filazana mavesa-danja' : '2 alertes critiques'}
                </Text>
                <Text style={[typography.caption, { color: theme.danger, opacity: 0.75, marginTop: 2 }]}>
                  {lang === 'mg' ? 'Tsindrio handre antsipirihana' : 'Appuyer pour voir les détails'}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.danger} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.lg,
    paddingTop: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    position: 'absolute', top: 0, right: 0,
    width: 200, height: 200, borderRadius: 100,
    opacity: 0.6,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start' },

  syncBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },

  bellBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, position: 'relative',
  },
  bellBadge: {
    position: 'absolute', top: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  fokoPill: {
    alignSelf: 'flex-start', marginTop: spacing.md,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  qaContainer: {
    borderRadius: radius.xl, borderWidth: 1,
    overflow: 'hidden',
  },
  qaRow: { flexDirection: 'row', justifyContent: 'space-around', padding: spacing.lg },
  qaDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: spacing.lg },

  qaWrap: { alignItems: 'center', width: 76 },
  qaIcon: {
    width: 56, height: 56, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },

  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, minHeight: 60,
  },
  activityIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  alertCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.lg, borderRadius: radius.xl,
    borderWidth: 1,
  },
});
