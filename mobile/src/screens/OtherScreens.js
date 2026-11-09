// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Écrans Citoyens / Dossiers / Paiements / Paramètres
// ═══════════════════════════════════════════════════════════════
import {SyncPanel} from './OfflineRecords';
import React, { useState, useRef, useEffect } from 'react';
import {
  Alert, View, Text, ScrollView, FlatList, TouchableOpacity,
  StyleSheet, Animated, StatusBar, Switch, TextInput,
} from 'react-native';
import {
  Search, Plus, User, MapPin, Phone, CreditCard,
  FileText, Clock, CheckCircle2, XCircle, Filter,
  Sun, Moon, Globe, LogOut, Info, Bell, Shield,
  RefreshCw, ChevronRight, Banknote, TrendingUp,
  ArrowUpRight, ArrowDownLeft,
} from 'lucide-react-native';
import { useTheme, useAuth, useLang } from '../context/AppContext';
import {
  Card, Button, Input, StatusBadge, SectionHeader,
  FilterChip, ListRow, Avatar, Divider,
} from '../components/UIKit';
import { typography, spacing, radius, shadows, touchTarget } from '../theme';

// ════════════════════════════════════════════════════════════════
//  ÉCRAN CITOYENS
// ════════════════════════════════════════════════════════════════
export {CitoyensScreen,DossiersScreen} from './OfflineRecords';

export function PaiementsScreen() {
  const { theme } = useTheme();
  const { tr, lang } = useLang();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { transactionsAPI } = require('../services/api');
    setLoading(true);
    transactionsAPI.list({ limit: 50 })
      .then(res => { setData(res); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const total = data
    .filter(p => p.statut === 'Confirmé' && p.type_paiement !== 'Démo')
    .reduce((sum, p) => sum + (p.montant || 0), 0);

  const statusLabels = {
    valide:     tr('common', 'valide'),
    en_cours:   tr('common', 'enCours'),
    en_attente: tr('common', 'enAttente'),
    rejete:     tr('common', 'rejete'),
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* En-tête */}
      <View style={[styles.screenHeader, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>{tr('paiements', 'titre')}</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.accent }]}>
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Carte total */}
        <View style={{ padding: spacing.lg }}>
          <Card style={{
            background: 'transparent',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Fond décoratif */}
            <View style={[styles.totalBg, { backgroundColor: theme.accent }]} />
            <View style={{ position: 'relative' }}>
              <Text style={[typography.label, { color: '#fff', opacity: 0.75 }]}>
                {tr('paiements', 'total')} · {tr('paiements', 'mois')}
              </Text>
              <Text style={[typography.display, { color: '#fff', marginTop: 6 }]}>
                {total.toLocaleString()} Ar
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg }}>
                {[
                  { label: tr('paiements', 'aujourd'), val: '—' },
                  { label: tr('paiements', 'semaine'), val: '—' },
                ].map(item => (
                  <View key={item.label}>
                    <Text style={[typography.caption, { color: '#fff', opacity: 0.65 }]}>{item.label}</Text>
                    <Text style={[typography.h4, { color: '#fff', marginTop: 2 }]}>{item.val} Ar</Text>
                  </View>
                ))}
              </View>
            </View>
          </Card>

          {/* Bouton nouveau paiement */}
          <Button
            label={tr('paiements', 'nouveau')}
            icon={<Banknote size={18} color="#fff" />}
            style={{ marginTop: spacing.lg }}
          />
        </View>

        {/* Historique */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SectionHeader title={lang === 'mg' ? 'Tantara' : 'Historique'} />
          <Card padding={0} style={{ overflow: 'hidden' }}>
            {data.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.75}
                style={[
                  styles.payRow,
                  {
                    borderBottomColor: theme.border,
                    borderBottomWidth: index < data.length - 1 ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
              >
                <View style={[styles.payIcon, { backgroundColor: theme.successBg }]}>
                  <ArrowUpRight size={18} color={theme.success} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[typography.body, { color: theme.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                    {item.type_paiement || '—'}
                  </Text>
                  <Text style={[typography.caption, { color: theme.textMuted, marginTop: 2 }]}>{item.citoyen?.nom || item.citoyen_nom || '—'} · {item.date_transaction ? new Date(item.date_transaction).toLocaleDateString('fr-FR') : '—'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[typography.body, { color: theme.textPrimary, fontWeight: '700' }]}>
                    {(item.montant || 0).toLocaleString('fr-FR')} Ar
                  </Text>
                  <StatusBadge status={item.statut?.toLowerCase() || 'inconnu'} label={item.statut || '—'} />
                </View>
              </TouchableOpacity>
            ))}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
//  ÉCRAN PARAMÈTRES
// ════════════════════════════════════════════════════════════════
export function ParametresScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { tr, lang, setLang } = useLang();
  const { user, logout } = useAuth();

  const SettingRow = ({ icon: Icon, label, right, onPress, color, last }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[
        styles.settingRow,
        {
          borderBottomColor: theme.border,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: (color || theme.accent) + '18' }]}>
        <Icon size={18} color={color || theme.accent} />
      </View>
      <Text style={[typography.body, { color: theme.textPrimary, flex: 1, marginLeft: spacing.md }]}>
        {label}
      </Text>
      {right ?? <ChevronRight size={16} color={theme.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={[styles.screenHeader, { backgroundColor: theme.bgCard, borderBottomColor: theme.border }]}>
        <Text style={[typography.h2, { color: theme.textPrimary }]}>{tr('parametres', 'titre')}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>

          {/* Carte compte */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar
                initials={user?.avatar ?? '??'}
                size={52}
                color={theme.accent}
              />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={[typography.h3, { color: theme.textPrimary }]}>{user?.name}</Text>
                <Text style={[typography.bodySm, { color: theme.textMuted, marginTop: 2 }]}>{user?.role}</Text>
                <View style={[styles.fokoPill2, { backgroundColor: theme.accentBg }]}>
                  <MapPin size={10} color={theme.accent} />
                  <Text style={[typography.caption, { color: theme.accent, marginLeft: 4 }]}>
                    {user?.fokontany}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          {/* Apparence */}
          <View>
            <Text style={[typography.label, { color: theme.textMuted, marginBottom: spacing.sm, paddingHorizontal: 2 }]}>
              {tr('parametres', 'apparence')}
            </Text>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <SettingRow
                icon={isDark ? Moon : Sun}
                label={tr('parametres', 'theme')}
                onPress={toggleTheme}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[typography.bodySm, { color: theme.textMuted }]}>
                      {isDark ? tr('common', 'modeSombre') : tr('common', 'modeClair')}
                    </Text>
                    <Switch
                      value={isDark}
                      onValueChange={toggleTheme}
                      trackColor={{ false: theme.border, true: theme.accent + '60' }}
                      thumbColor={isDark ? theme.accent : theme.textMuted}
                    />
                  </View>
                }
              />
              <SettingRow
                icon={Globe}
                label={tr('parametres', 'langue')}
                last
                right={
                  <View style={styles.langSwitch}>
                    {['fr', 'mg'].map(l => (
                      <TouchableOpacity
                        key={l}
                        onPress={() => setLang(l)}
                        style={[
                          styles.langBtn,
                          { backgroundColor: lang === l ? theme.accent : theme.glass, borderColor: lang === l ? theme.accent : theme.border },
                        ]}
                      >
                        <Text style={[typography.btnSm, { color: lang === l ? '#fff' : theme.textSecondary }]}>
                          {l === 'fr' ? tr('parametres', 'fr') : tr('parametres', 'mg')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                }
              />
            </Card>
          </View>

          {/* Autres réglages */}
          <View>
            <Text style={[typography.label, { color: theme.textMuted, marginBottom: spacing.sm, paddingHorizontal: 2 }]}>
              {lang === 'mg' ? 'Hafa' : 'Divers'}
            </Text>
            <Card padding={0} style={{ overflow: 'hidden' }}>
              <SettingRow icon={Bell}     label={tr('parametres', 'notifications')} />
              <SettingRow icon={Shield}   label={tr('parametres', 'securite')} />

              <SettingRow icon={Info}     label={tr('parametres', 'apropos')}
                right={
                  <Text style={[typography.caption, { color: theme.textMuted }]}>v1.0.2</Text>
                }
                last
              />
            </Card>
          </View>

          <SyncPanel details/>
          {/* Déconnexion */}
          <Button
            label={tr('parametres', 'deconnecter')}
            variant="danger"
            icon={<LogOut size={18} color={theme.danger} />}
            onPress={()=>Alert.alert('Déconnexion', 'Le cache et les saisies non transmises de ce compte seront effacés de cet appareil.', [{text:'Annuler',style:'cancel'},{text:'Déconnecter',style:'destructive',onPress:()=>logout().catch(e=>Alert.alert('Déconnexion impossible',e.message))}])}
          />

        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles communs ─────────────────────────────────────────────
const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
    paddingTop: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, height: 42,
    borderRadius: radius.lg, borderWidth: 1,
  },
  filterBtn: {
    width: 42, height: 42, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  filtersRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  citoyenCard: {
    borderRadius: radius.xl, padding: spacing.md,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  citoyenDetails: {
    marginTop: spacing.md, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, gap: 6,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60 },

  payRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, minHeight: 64,
  },
  payIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  totalBg: {
    position: 'absolute', top: -20, right: -20,
    width: 150, height: 150, borderRadius: 75, opacity: 0.25,
  },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, minHeight: touchTarget.min,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },

  fokoPill2: {
    flexDirection: 'row', alignItems: 'center',
    alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, marginTop: 6,
  },

  langSwitch: { flexDirection: 'row', gap: 6 },
  langBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1,
  },
});
