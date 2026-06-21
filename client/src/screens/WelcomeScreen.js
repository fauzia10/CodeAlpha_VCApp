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

const { width, height } = Dimensions.get('window');
const isWide = width >= 900;

export default function WelcomeScreen({ navigation }) {
  const { themeMode, toggleTheme } = useContext(AuthContext);
  const isDark = themeMode === 'dark';

  // Entrance animation values
  const cardFade = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(cardFade, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  const styles = getStyles(isDark, isWide);

  return (
    <View style={styles.root}>
      {/* Soft Background Texture / Glows */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: headerFade }]}>
        <Image
          source={isDark ? require('../../assets/syncora-logo-dark.png') : require('../../assets/syncora-logo-light.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <TouchableOpacity style={styles.themeBtn} onPress={toggleTheme} activeOpacity={0.7}>
          <Text style={styles.themeBtnText}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.glassCard,
            { opacity: cardFade, transform: [{ translateY: cardSlide }] },
          ]}
        >
          <Text style={styles.title}>Welcome to Syncora</Text>
          <Text style={styles.subtitle}>
            A cozy space for video calls, chat, screen sharing, and shared ideas.
          </Text>

          <View style={styles.featurePills}>
            {['🎥 Video calls', '💬 Live chat', '🖥️ Screen sharing', '✨ Whiteboard'].map((f) => (
              <View key={f} style={styles.pill}>
                <Text style={styles.pillText}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Create or join a meeting</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Made for better conversations.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (isDark, isWide) => {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: isDark ? '#110A0D' : '#FFF5F8',
      overflow: 'hidden',
    },

    // Background Glows
    bgGlow1: {
      position: 'absolute',
      top: -height * 0.1,
      left: -width * 0.2,
      width: width * 1.2,
      height: height * 0.6,
      borderRadius: 9999,
      backgroundColor: isDark ? '#4A1628' : '#F7B6C8',
      opacity: isDark ? 0.15 : 0.25,
      ...(Platform.OS === 'web' && { filter: 'blur(100px)' }),
    },
    bgGlow2: {
      position: 'absolute',
      bottom: -height * 0.1,
      right: -width * 0.1,
      width: width * 0.8,
      height: height * 0.5,
      borderRadius: 9999,
      backgroundColor: isDark ? '#3D1A26' : '#FCE7EF',
      opacity: isDark ? 0.2 : 0.4,
      ...(Platform.OS === 'web' && { filter: 'blur(80px)' }),
    },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 20,
      zIndex: 10,
    },
    headerLogo: {
      height: 38,
      width: 140,
    },
    themeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(247,182,200,0.1)' : 'rgba(233,137,166,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    themeBtnText: {
      fontSize: 18,
    },

    // Layout
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 40,
    },

    // Glass Card
    glassCard: {
      width: '100%',
      maxWidth: isWide ? 640 : 480,
      backgroundColor: isDark ? 'rgba(41,27,33,0.85)' : 'rgba(255,255,255,0.8)',
      borderRadius: 24,
      padding: isWide ? 48 : 32,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(247,182,200,0.15)' : 'rgba(233,137,166,0.25)',
      alignItems: 'center',
      ...(Platform.OS === 'web' && {
        backdropFilter: 'blur(20px)',
        boxShadow: isDark
          ? '0 12px 60px rgba(247,182,200,0.05)'
          : '0 12px 60px rgba(233,137,166,0.15)',
      }),
    },

    title: {
      fontSize: isWide ? 38 : 30,
      fontWeight: '900',
      color: isDark ? '#F7D6E0' : '#3D2630',
      marginBottom: 12,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: isWide ? 16 : 15,
      color: isDark ? 'rgba(247,182,200,0.7)' : 'rgba(61,38,48,0.7)',
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
      maxWidth: 400,
    },

    // Feature Pills
    featurePills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 40,
    },
    pill: {
      backgroundColor: isDark ? 'rgba(247,182,200,0.1)' : '#FCE7EF',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(247,182,200,0.2)' : 'rgba(233,137,166,0.3)',
    },
    pillText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#F7B6C8' : '#E989A6',
    },

    // Actions
    actionSection: {
      width: '100%',
      gap: 14,
    },
    primaryButton: {
      backgroundColor: '#E989A6',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      ...(Platform.OS === 'web' && {
        boxShadow: '0 4px 20px rgba(233,137,166,0.4)',
      }),
    },
    primaryButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    secondaryButton: {
      backgroundColor: isDark ? 'rgba(247,182,200,0.05)' : 'transparent',
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: isDark ? 'rgba(247,182,200,0.3)' : '#E989A6',
    },
    secondaryButtonText: {
      color: isDark ? '#F7B6C8' : '#E989A6',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.5,
    },

    // Footer
    footer: {
      marginTop: 40,
    },
    footerText: {
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? 'rgba(247,182,200,0.4)' : 'rgba(61,38,48,0.4)',
      letterSpacing: 0.5,
    },
  });
};
