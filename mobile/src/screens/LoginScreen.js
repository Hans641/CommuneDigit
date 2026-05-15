// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Écran de connexion
//  Bastien & Scapin :
//   - Guidage : labels explicites, erreur claire et immédiate
//   - Charge de travail : pré-remplissage via accès rapide démo
//   - Contrôle : bouton désactivé si champs vides
//   - Gestion des erreurs : message localisé, champ en erreur mis en rouge
// ═══════════════════════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, KeyboardAvoidingView,
  Platform, StatusBar, Image,
} from 'react-native';
import { User, Lock, Zap, Sun, Moon, Globe } from 'lucide-react-native';
import { useTheme, useAuth, useLang } from '../context/AppContext';
import { Input, Button, AlertBanner } from '../components/UIKit';
import { typography, spacing, radius, shadows } from '../theme';

// Comptes de connexion rapide — utilise les matricules réels du backend
const DEMO_USERS = [
  { label: 'Admin Hans',    username: 'AGT-0001', password: 'admin123',  role: 'Administrateur',  avatar: 'AH', color: '#10b981' },
  { label: 'Rakoto Jean',   username: 'AGT-0002', password: 'agent123',  role: 'Agent Fokontany', avatar: 'RJ', color: '#14b8a6' },
  { label: 'Rabe Ministre', username: 'AGT-0003', password: 'mid2024',   role: 'Ministère MID',   avatar: 'RM', color: '#8b5cf6' },
];

export default function LoginScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { lang, toggleLang, tr } = useLang();
  const { login } = useAuth();

  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showDemo,  setShowDemo]  = useState(false);

  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  // Animation d'apparition
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 600, useNativeDriver: true,
    }).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || tr('login', 'erreur'));
      shake();
    }
  };

  const handleDemoLogin = async (demo) => {
    setUsername(demo.username);
    setPassword(demo.password);
    setShowDemo(false);
    setLoading(true);
    setError('');
    const result = await login(demo.username, demo.password);
    setLoading(false);
    if (!result.success) {
      setError(result.error || tr('login', 'erreur'));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {/* Fond décoratif */}
      <View style={[styles.bgBlob1, { backgroundColor: theme.accentBg }]} />
      <View style={[styles.bgBlob2, { backgroundColor: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.06)' }]} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

          {/* ── Contrôles thème / langue (coin haut droit) ── */}
          <View style={styles.topControls}>
            <TouchableOpacity
              onPress={toggleLang}
              style={[styles.controlBtn, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
              accessibilityLabel={tr('common', 'langue')}
            >
              <Globe size={16} color={theme.textSecondary} />
              <Text style={[typography.btnSm, { color: theme.textSecondary, marginLeft: 4 }]}>
                {lang === 'fr' ? 'MG' : 'FR'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.controlBtn, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
              accessibilityLabel={isDark ? tr('common', 'modeClair') : tr('common', 'modeSombre')}
            >
              {isDark
                ? <Sun  size={16} color={theme.textSecondary} />
                : <Moon size={16} color={theme.textSecondary} />
              }
            </TouchableOpacity>
          </View>

          {/* ── Logo & titre ── */}
          <View style={styles.logoArea}>
            <View style={[styles.logoIcon, { backgroundColor: theme.accent }]}>
              <Text style={styles.logoEmoji}>🌿</Text>
            </View>
            <Text style={[typography.display, { color: theme.textPrimary, marginTop: spacing.lg }]}>
              CommuneDigit
            </Text>
            <Text style={[typography.body, { color: theme.textMuted, marginTop: spacing.xs, textAlign: 'center' }]}>
              {tr('login', 'sousTitre')}
            </Text>

            {/* Pays */}
            <View style={[styles.countryBadge, { backgroundColor: theme.accentBg, borderColor: theme.accent + '40' }]}>
              <Text style={[typography.caption, { color: theme.accent, fontWeight: '700' }]}>
                🇲🇬 &nbsp; Ministère de l'Intérieur · Digitalisation
              </Text>
            </View>
          </View>

          {/* ── Formulaire ── */}
          <Animated.View
            style={[
              styles.formCard,
              {
                backgroundColor: theme.bgCard,
                borderColor: theme.border,
                transform: [{ translateX: shakeAnim }],
                ...shadows.lg,
                shadowColor: theme.shadowColor,
                shadowOpacity: theme.shadowOpacity,
              },
            ]}
          >
            <Text style={[typography.h3, { color: theme.textPrimary, marginBottom: spacing.xl }]}>
              {tr('login', 'titre')}
            </Text>

            {error ? <AlertBanner type="error" message={error} /> : null}

            <Input
              label={tr('login', 'identifiant')}
              value={username}
              onChangeText={setUsername}
              placeholder="admin"
              icon={<User size={18} color={theme.textMuted} />}
              error={error ? ' ' : ''}
            />

            <Input
              label={tr('login', 'motDePasse')}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              icon={<Lock size={18} color={theme.textMuted} />}
              error={error ? ' ' : ''}
            />

            <Button
              label={loading ? tr('login', 'enCours') : tr('login', 'btnConnexion')}
              onPress={handleLogin}
              loading={loading}
              disabled={!username.trim() || !password.trim()}
              style={{ marginTop: spacing.sm }}
            />
          </Animated.View>

          {/* ── Accès rapide démo ── */}
          <View style={{ marginTop: spacing.xxl }}>
            <TouchableOpacity
              onPress={() => setShowDemo(!showDemo)}
              style={[styles.demoToggle, { backgroundColor: theme.glass, borderColor: theme.glassBorder }]}
            >
              <Zap size={14} color={theme.accent} />
              <Text style={[typography.btnSm, { color: theme.accent, marginLeft: 6 }]}>
                {tr('login', 'accesDrapide')}
              </Text>
            </TouchableOpacity>

            {showDemo && (
              <View style={[styles.demoPanel, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                {DEMO_USERS.map(demo => (
                  <TouchableOpacity
                    key={demo.username}
                    onPress={() => handleDemoLogin(demo)}
                    activeOpacity={0.75}
                    style={[styles.demoItem, { borderBottomColor: theme.border }]}
                  >
                    <View style={[styles.demoAvatar, { backgroundColor: demo.color + '22' }]}>
                      <Text style={[typography.h4, { color: demo.color }]}>{demo.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body, { color: theme.textPrimary, fontWeight: '600' }]}>
                        {demo.label}
                      </Text>
                      <Text style={[typography.caption, { color: theme.textMuted }]}>{demo.role}</Text>
                    </View>
                    <Text style={[typography.caption, { color: theme.textMuted }]}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Footer */}
          <Text style={[typography.caption, { color: theme.textMuted, textAlign: 'center', marginTop: spacing.xxxl }]}>
            CommuneDigit v1.0.2 · {lang === 'mg' ? 'Lalàna 2014-038' : 'Loi 2014-038'} 🇲🇬
          </Text>

        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  container: { flex: 1, padding: spacing.xl, paddingTop: 60 },

  bgBlob1: {
    position: 'absolute', top: -80, right: -80,
    width: 260, height: 260, borderRadius: 130,
  },
  bgBlob2: {
    position: 'absolute', bottom: 100, left: -60,
    width: 200, height: 200, borderRadius: 100,
  },

  topControls: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 8,
    marginBottom: spacing.xxxl,
  },
  controlBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1,
    minWidth: 44, minHeight: 36,
    justifyContent: 'center',
  },

  logoArea: { alignItems: 'center', marginBottom: spacing.xxxl },
  logoIcon: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  logoEmoji: { fontSize: 36 },

  countryBadge: {
    marginTop: spacing.lg, paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
  },

  formCard: {
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing.xxl,
  },

  demoToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: radius.full, borderWidth: 1,
    alignSelf: 'center',
  },

  demoPanel: {
    marginTop: spacing.md, borderRadius: radius.xl,
    borderWidth: 1, overflow: 'hidden',
  },
  demoItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  demoAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
});
