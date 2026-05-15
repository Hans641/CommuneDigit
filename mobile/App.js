// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — App.js (Point d'entrée)
//  Orchestre : Login → Dashboard avec BottomNav
//  Bastien & Scapin :
//   - Guidage : feedback visuel à chaque transition
//   - Contrôle explicite : état de navigation toujours visible (tab actif)
//   - Homogénéité : transitions cohérentes partout
// ═══════════════════════════════════════════════════════════════
import React, { useRef, useEffect } from 'react';
import {
  View, StyleSheet, Animated, Platform, StatusBar,
} from 'react-native';
import { AppProvider, useAuth, useTheme } from './src/context/AppContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen  from './src/screens/HomeScreen';
import {
  CitoyensScreen,
  DossiersScreen,
  PaiementsScreen,
  ParametresScreen,
} from './src/screens/OtherScreens';
import BottomNav from './src/navigation/BottomNav';

// ── Wrapper interne (accès aux contextes) ─────────────────────
function AppInner() {
  const { user }    = useAuth();
  const { theme }   = useTheme();
  const [activeTab, setActiveTab] = React.useState('accueil');

  // Transition fade login → dashboard
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350, useNativeDriver: true,
    }).start();
  }, [user]);

  // ── Pas connecté → Login ───────────────────────────────────
  if (!user) {
    return (
      <Animated.View style={[styles.root, { opacity: fadeAnim, backgroundColor: theme.bg }]}>
        <LoginScreen />
      </Animated.View>
    );
  }

  // ── Connecté → Dashboard + BottomNav ──────────────────────
  const navigate = (tab) => setActiveTab(tab);

  const renderScreen = () => {
    switch (activeTab) {
      case 'accueil':    return <HomeScreen     onNavigate={navigate} />;
      case 'citoyens':   return <CitoyensScreen />;
      case 'dossiers':   return <DossiersScreen />;
      case 'paiements':  return <PaiementsScreen />;
      case 'parametres': return <ParametresScreen />;
      default:           return <HomeScreen onNavigate={navigate} />;
    }
  };

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim, backgroundColor: theme.bg }]}>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {/* Écran actif */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Barre de navigation en bas */}
      <BottomNav
        activeTab={activeTab}
        onTabPress={setActiveTab}
        badges={{ dossiers: 3, alertes: 2 }}
      />
    </Animated.View>
  );
}

// ── Root avec providers ────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
});
