// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Barre de navigation inférieure
//  Bastien & Scapin :
//   - Guidage : icône + label toujours visible (pas seulement icône)
//   - Contrôle : onglet actif clairement différencié (couleur + taille)
//   - Compatibilité : position bottom conforme aux conventions iOS/Android
//   - Zone tactile : ≥ 44pt par onglet (recommandation Apple HIG / Material)
//   - Feedback : animation de scale + indicateur actif animé
// ═══════════════════════════════════════════════════════════════
import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, Animated, Platform, Dimensions,
} from 'react-native';
import {
  Home, Users, FolderOpen, CreditCard, Settings,
} from 'lucide-react-native';
import { useTheme } from '../context/AppContext';
import { useLang }  from '../context/AppContext';
import { typography, spacing, radius, shadows } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / 5;

// ── Onglet individuel ──────────────────────────────────────────
function TabItem({ icon: Icon, label, active, onPress, badge }) {
  const { theme } = useTheme();
  const scale  = useRef(new Animated.Value(active ? 1 : 0.95)).current;
  const labelY = useRef(new Animated.Value(active ? 0 : 3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: active ? 1.08 : 0.95,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(labelY, {
        toValue: active ? 0 : 2,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [active]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.tab}
      // Zone tactile élargie — Bastien & Scapin : Contrôle explicite
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.tabInner, { transform: [{ scale }] }]}>
        {/* Indicateur fond actif */}
        {active && (
          <View style={[styles.activePill, { backgroundColor: theme.accentBg }]} />
        )}

        {/* Badge notification */}
        {badge > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.danger }]}>
            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}

        {/* Icône */}
        <Icon
          size={active ? 24 : 22}
          color={active ? theme.navActive : theme.navInactive}
          strokeWidth={active ? 2.5 : 1.8}
        />

        {/* Label — toujours visible (guidage Bastien & Scapin) */}
        <Animated.Text
          style={[
            typography.navLabel,
            {
              color: active ? theme.navActive : theme.navInactive,
              fontWeight: active ? '700' : '500',
              marginTop: 3,
              transform: [{ translateY: labelY }],
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Barre principale ───────────────────────────────────────────
export default function BottomNav({ activeTab, onTabPress, badges = {} }) {
  const { theme } = useTheme();
  const { tr }    = useLang();

  const tabs = [
    { id: 'accueil',    icon: Home,       label: tr('nav', 'accueil')    },
    { id: 'citoyens',   icon: Users,      label: tr('nav', 'citoyens')   },
    { id: 'dossiers',   icon: FolderOpen, label: tr('nav', 'dossiers')   },
    { id: 'paiements',  icon: CreditCard, label: tr('nav', 'paiements')  },
    { id: 'parametres', icon: Settings,   label: tr('nav', 'parametres') },
  ];

  // Indicateur de position glissant
  const indicatorX = useRef(new Animated.Value(
    tabs.findIndex(t => t.id === activeTab) * TAB_WIDTH
  )).current;

  useEffect(() => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    Animated.spring(indicatorX, {
      toValue: idx * TAB_WIDTH + (TAB_WIDTH - 28) / 2,
      useNativeDriver: true,
      tension: 400,
      friction: 28,
    }).start();
  }, [activeTab]);

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: theme.navBg,
        borderTopColor: theme.navBorder,
        ...shadows.lg,
        shadowColor: theme.shadowColor,
        shadowOpacity: theme.shadowOpacity * 1.5,
      },
    ]}>
      {/* Indicateur glissant en haut de la barre */}
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: theme.accent, transform: [{ translateX: indicatorX }] },
        ]}
      />

      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          icon={tab.icon}
          label={tab.label}
          active={activeTab === tab.id}
          onPress={() => onTabPress(tab.id)}
          badge={badges[tab.id] || 0}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 20 : 4, // safe area iOS
    paddingTop: 6,
    position: 'relative',
  },

  indicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    width: 28,
    borderRadius: 2,
  },

  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Zone tactile minimum 44pt
    minHeight: 52,
  },

  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'relative',
  },

  activePill: {
    position: 'absolute',
    top: -4, bottom: -4,
    left: -10, right: -10,
    borderRadius: radius.md,
  },

  badge: {
    position: 'absolute',
    top: -6, right: -10,
    minWidth: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
