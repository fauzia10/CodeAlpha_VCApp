import React, { useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { getColors } from '../theme/colors';

const { width } = Dimensions.get('window');
const isWideScreen = Platform.OS === 'web' && width > 768;

export default function LandingScreen({ navigation }) {
  const { themeMode, toggleTheme } = useContext(AuthContext);
  const COLORS = getColors(themeMode);
  const styles = getStyles(COLORS);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/logo.png')} style={styles.navLogo} />
            <Text style={styles.navBrand}>Syncora</Text>
          </View>
          <View style={styles.navActions}>
            <TouchableOpacity style={styles.themeToggle} onPress={toggleTheme}>
              <Text style={styles.themeToggleText}>{themeMode === 'dark' ? '☀️ Light' : '🌙 Dark'}</Text>
            </TouchableOpacity>
            {isWideScreen && (
              <TouchableOpacity
                style={styles.navLoginBtn}
                onPress={() => navigation.navigate('Auth')}
              >
                <Text style={styles.navLoginText}>Login</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroGlow} />
          <Image source={require('../../assets/logo.png')} style={styles.heroLogo} />
          <Text style={styles.heroTitle}>Meet beautifully. Create together.</Text>
          <Text style={styles.heroSubtitle}>
            Video calls, chat, screen sharing, and collaborative whiteboards in one cozy space.
          </Text>
          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('Auth', { isLogin: false })}
            >
              <Text style={styles.primaryButtonText}>Start a meeting</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Auth', { isLogin: true })}
            >
              <Text style={styles.secondaryButtonText}>Join a meeting</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Everything you need</Text>
          <View style={styles.featuresGrid}>
            <FeatureCard
              icon="📹"
              title="Video meetings"
              desc="Crystal clear audio and video with adaptive layout modes."
              styles={styles}
            />
            <FeatureCard
              icon="💬"
              title="Live chat"
              desc="Instant messaging, file sharing, and fun GIF reactions."
              styles={styles}
            />
            <FeatureCard
              icon="💻"
              title="Screen sharing"
              desc="Present your screen seamlessly to everyone in the room."
              styles={styles}
            />
            <FeatureCard
              icon="🎨"
              title="Whiteboard"
              desc="Brainstorm together on a shared infinite canvas in real-time."
              styles={styles}
            />
          </View>
        </View>

        {/* How it works Section */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepsGrid}>
            <StepCard number="1" title="Create a room" desc="Sign up and generate a unique secure room ID." styles={styles} />
            <StepCard number="2" title="Share the code" desc="Send the code to your friends or colleagues." styles={styles} />
            <StepCard number="3" title="Meet & Collaborate" desc="Jump in and start creating together instantly." styles={styles} />
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <Image source={require('../../assets/logo.png')} style={styles.footerLogo} />
          <Text style={styles.footerTagline}>Syncora — The cozy collaboration space.</Text>
          <Text style={styles.footerCopyright}>© {new Date().getFullYear()} Syncora. All rights reserved.</Text>
        </View>
      </View>
    </View>
  );
}

const FeatureCard = ({ icon, title, desc, styles }) => (
  <View style={styles.featureCard}>
    <View style={styles.featureIconContainer}>
      <Text style={styles.featureIcon}>{icon}</Text>
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDesc}>{desc}</Text>
  </View>
);

const StepCard = ({ number, title, desc, styles }) => (
  <View style={styles.stepCard}>
    <View style={styles.stepNumberContainer}>
      <Text style={styles.stepNumber}>{number}</Text>
    </View>
    <Text style={styles.stepTitle}>{title}</Text>
    <Text style={styles.stepDesc}>{desc}</Text>
  </View>
);

const getStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(10px)' }),
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
    resizeMode: 'contain',
  },
  navBrand: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  themeToggle: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  themeToggleText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '600',
  },
  navLoginBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  navLoginText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  heroSection: {
    paddingVertical: 80,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: COLORS.secondary,
    opacity: 0.4,
    top: -100,
    ...(Platform.OS === 'web' && { filter: 'blur(80px)' }),
    zIndex: -1,
  },
  heroLogo: {
    width: 80,
    height: 80,
    marginBottom: 24,
    resizeMode: 'contain',
  },
  heroTitle: {
    fontSize: isWideScreen ? 56 : 40,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: isWideScreen ? 64 : 48,
  },
  heroSubtitle: {
    fontSize: isWideScreen ? 20 : 16,
    color: COLORS.textMuted,
    textAlign: 'center',
    maxWidth: 600,
    marginBottom: 40,
    lineHeight: 28,
  },
  heroButtons: {
    flexDirection: isWideScreen ? 'row' : 'column',
    gap: 16,
    width: isWideScreen ? 'auto' : '100%',
    maxWidth: 400,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  featuresSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 40,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: isWideScreen ? 'row' : 'column',
    flexWrap: 'wrap',
    gap: 24,
    maxWidth: 1000,
    justifyContent: 'center',
  },
  featureCard: {
    backgroundColor: COLORS.background,
    padding: 24,
    borderRadius: 20,
    width: isWideScreen ? 220 : '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  featureIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  featureDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepsSection: {
    paddingVertical: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  stepsGrid: {
    flexDirection: isWideScreen ? 'row' : 'column',
    gap: 32,
    maxWidth: 900,
    justifyContent: 'center',
  },
  stepCard: {
    alignItems: 'center',
    width: isWideScreen ? 250 : '100%',
  },
  stepNumberContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    backgroundColor: COLORS.surface,
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  footerContent: {
    alignItems: 'center',
    maxWidth: 1000,
    alignSelf: 'center',
  },
  footerLogo: {
    width: 40,
    height: 40,
    marginBottom: 16,
    resizeMode: 'contain',
    opacity: 0.8,
  },
  footerTagline: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 8,
  },
  footerCopyright: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
