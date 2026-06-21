import React, { useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { getColors } from '../theme/colors';

const { width, height } = Dimensions.get('window');
const isWide = Platform.OS === 'web' && width >= 900;

// Feature chip data
const FEATURES = [
  { icon: '🎥', label: 'HD Video' },
  { icon: '💬', label: 'Live Chat' },
  { icon: '🖥️', label: 'Screen Share' },
  { icon: '🎨', label: 'Whiteboard' },
  { icon: '🤖', label: 'AI Summary' },
];

export default function WelcomeScreen({ navigation }) {
  const { themeMode, toggleTheme } = useContext(AuthContext);
  const COLORS = getColors(themeMode);
  const styles  = getStyles(COLORS, themeMode);
  const isDark  = themeMode === 'dark';

  // Entrance animation values
  const heroFade  = useRef(new Animated.Value(0)).current;
  const heroSlide = useRef(new Animated.Value(30)).current;
  const cardFade  = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(heroSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(cardFade, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 0, duration: 550, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      {/* Background glows */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      {/* Header bar */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image 
            source={isDark ? require('../../assets/syncora-logo-dark.png') : require('../../assets/syncora-logo-light.png')} 
            style={styles.headerLogo} 
            resizeMode="contain" 
          />
        </View>
        <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme} accessibilityLabel="Toggle theme">
          <Text style={styles.themeBtnText}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero section */}
        <Animated.View
          style={[
            styles.heroSection,
            { opacity: heroFade, transform: [{ translateY: heroSlide }] },
          ]}
        >
          <View style={styles.logoRing}>
            <Image source={isDark ? require('../../assets/syncora-logo-dark.png') : require('../../assets/syncora-logo-light.png')} style={styles.heroLogo} resizeMode="contain" />
          </View>
          <Text style={styles.heroTitle}>Welcome to Syncora</Text>
          <Text style={styles.heroSubtitle}>
            Video calls, live chat, screen sharing and collaborative whiteboards — all in one beautiful space.
          </Text>

          {/* Feature chips */}
          <View style={styles.featureStrip}>
            {FEATURES.map((f) => (
              <View key={f.label} style={styles.featureChip}>
                <Text style={styles.featureChipIcon}>{f.icon}</Text>
                <Text style={styles.featureChipLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Action card */}
        <Animated.View
          style={[
            styles.actionCard,
            { opacity: cardFade, transform: [{ translateY: cardSlide }] },
          ]}
        >
          <Text style={styles.cardTitle}>Get started</Text>
          <Text style={styles.cardSubtitle}>Sign in to your account or create a new one</Text>

          {/* Sign in button */}
          <TouchableOpacity
            id="welcome-signin-btn"
            style={styles.signInButton}
            onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
            activeOpacity={0.85}
          >
            <Text style={styles.signInButtonText}>Sign in</Text>
          </TouchableOpacity>

          {/* Create account button */}
          <TouchableOpacity
            id="welcome-signup-btn"
            style={styles.signUpButton}
            onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}
            activeOpacity={0.85}
          >
            <Text style={styles.signUpButtonText}>Create account</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Join with code quick link */}
          <TouchableOpacity
            id="welcome-join-code-btn"
            style={styles.joinCodeButton}
            onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
            activeOpacity={0.8}
          >
            <Text style={styles.joinCodeText}>🔗  Have a room code? Sign in to join</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© {new Date().getFullYear()} Syncora · Meet beautifully.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (COLORS, themeMode) => {
  const isDark = themeMode === 'dark';

  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? '#110a0d' : '#FFF5F8',
      overflow: 'hidden',
    },

    // Background decorative glows
    bgGlow1: {
      position: 'absolute',
      top: -height * 0.08,
      left: -width * 0.15,
      width: width * 1.2,
      height: height * 0.55,
      borderRadius: 9999,
      backgroundColor: isDark ? '#4a1628' : '#F7B6C8',
      opacity: isDark ? 0.18 : 0.28,
      ...(Platform.OS === 'web' && { filter: 'blur(90px)' }),
    },
    bgGlow2: {
      position: 'absolute',
      bottom: -height * 0.08,
      right: -width * 0.1,
      width: width * 0.9,
      height: height * 0.45,
      borderRadius: 9999,
      backgroundColor: isDark ? '#3d1a26' : '#FCE7EF',
      opacity: isDark ? 0.22 : 0.45,
      ...(Platform.OS === 'web' && { filter: 'blur(70px)' }),
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: isDark ? 'rgba(247,182,200,0.1)' : 'rgba(233,137,166,0.15)',
      backgroundColor: isDark ? 'rgba(17,10,13,0.9)' : 'rgba(255,245,248,0.9)',
      ...(Platform.OS === 'web' && { backdropFilter: 'blur(12px)' }),
    },
    headerBrand: {
      flex: 1,
    },
    headerLogo: {
      height: 36,
      width: 140,
    },
    themeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? 'rgba(247,182,200,0.1)' : 'rgba(233,137,166,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeBtnText: {
      fontSize: 17,
    },

    // Scroll
    scrollContent: {
      paddingHorizontal: isWide ? 48 : 20,
      paddingBottom: 48,
      maxWidth: isWide ? 760 : undefined,
      alignSelf: isWide ? 'center' : undefined,
      width: '100%',
      flexGrow: 1,
    },

    // Hero
    heroSection: {
      alignItems: 'center',
      paddingTop: isWide ? 52 : 40,
      paddingBottom: 8,
      marginBottom: 8,
    },
    logoRing: {
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: isDark ? 'rgba(247,182,200,0.08)' : 'rgba(247,182,200,0.18)',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(247,182,200,0.2)' : 'rgba(233,137,166,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 28,
      ...(Platform.OS === 'web' && {
        boxShadow: isDark
          ? '0 0 48px rgba(247,182,200,0.2)'
          : '0 0 48px rgba(247,182,200,0.35)',
      }),
    },
    heroLogo: {
      width: 90,
      height: 90,
    },
    heroTitle: {
      fontSize: isWide ? 40 : 32,
      fontWeight: '900',
      color: isDark ? '#F7D6E0' : '#3D2630',
      textAlign: 'center',
      marginBottom: 14,
      letterSpacing: 0.4,
    },
    heroSubtitle: {
      fontSize: isWide ? 17 : 14,
      color: isDark ? 'rgba(247,182,200,0.65)' : 'rgba(61,38,48,0.6)',
      textAlign: 'center',
      lineHeight: 24,
      maxWidth: 480,
      marginBottom: 28,
    },

    // Feature chips row
    featureStrip: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
      marginTop: 4,
    },
    featureChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(247,182,200,0.08)' : '#FCE7EF',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(247,182,200,0.15)' : 'rgba(233,137,166,0.3)',
    },
    featureChipIcon: { fontSize: 13 },
    featureChipLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#F7B6C8' : '#E989A6',
    },

    // Action card
    actionCard: {
      backgroundColor: isDark ? 'rgba(41,27,33,0.95)' : '#ffffff',
      borderRadius: 24,
      padding: isWide ? 40 : 28,
      marginTop: 28,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(247,182,200,0.14)' : 'rgba(233,137,166,0.25)',
      ...(Platform.OS === 'web' && {
        boxShadow: isDark
          ? '0 8px 48px rgba(247,182,200,0.06)'
          : '0 8px 40px rgba(233,137,166,0.1)',
      }),
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '800',
      color: isDark ? '#F7D6E0' : '#3D2630',
      marginBottom: 6,
      textAlign: 'center',
    },
    cardSubtitle: {
      fontSize: 13,
      color: isDark ? 'rgba(247,182,200,0.55)' : 'rgba(61,38,48,0.5)',
      textAlign: 'center',
      marginBottom: 28,
    },

    // Sign in (primary)
    signInButton: {
      backgroundColor: '#E989A6',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 12,
      ...(Platform.OS === 'web' && {
        boxShadow: '0 4px 20px rgba(233,137,166,0.45)',
        transition: 'box-shadow 0.2s',
      }),
    },
    signInButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },

    // Create account (outlined)
    signUpButton: {
      backgroundColor: isDark ? 'rgba(247,182,200,0.08)' : '#FCE7EF',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? 'rgba(247,182,200,0.3)' : '#E989A6',
      marginBottom: 20,
    },
    signUpButtonText: {
      color: isDark ? '#F7B6C8' : '#E989A6',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },

    // Divider
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? 'rgba(247,182,200,0.1)' : 'rgba(233,137,166,0.2)',
    },
    dividerText: {
      fontSize: 12,
      color: isDark ? 'rgba(247,182,200,0.35)' : 'rgba(61,38,48,0.35)',
      fontWeight: '600',
    },

    // Join with code (ghost)
    joinCodeButton: {
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 12,
    },
    joinCodeText: {
      fontSize: 13,
      color: isDark ? 'rgba(247,182,200,0.55)' : 'rgba(61,38,48,0.5)',
      fontWeight: '500',
    },

    // Footer
    footer: {
      alignItems: 'center',
      paddingVertical: 28,
    },
    footerText: {
      fontSize: 11,
      color: isDark ? 'rgba(247,182,200,0.3)' : 'rgba(61,38,48,0.3)',
      letterSpacing: 0.3,
    },
  });
};
