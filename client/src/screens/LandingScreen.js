import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Platform,
} from 'react-native';

const { width, height } = Dimensions.get('window');
const isWideScreen = width > 768;

const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LandingScreen({ navigation }) {
  // Navigation Bar (Scene 10)
  const navOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  // Animation values
  // Scene 1: Central Dot
  const dotOpacity = useRef(new Animated.Value(prefersReducedMotion ? 0 : 0)).current;
  const dotScale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  // Scene 2: Ripple Rings
  const ripple1Opacity = useRef(new Animated.Value(0)).current;
  const ripple1Scale = useRef(new Animated.Value(0.5)).current;
  const ripple2Opacity = useRef(new Animated.Value(0)).current;
  const ripple2Scale = useRef(new Animated.Value(0.5)).current;

  // Scene 3: Avatars & Lines
  const networkOpacity = useRef(new Animated.Value(0)).current;

  // Scene 4: Icons (replaces avatars)
  const iconsOpacity = useRef(new Animated.Value(0)).current;
  const iconsRotate = useRef(new Animated.Value(0)).current; // For the spiral inward
  const iconsScale = useRef(new Animated.Value(1)).current; // Shrinks to 0 during spiral

  // Scene 5: Logo Assembly
  const logoOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0.2)).current;
  const logoPulse = useRef(new Animated.Value(1)).current; // Pulsing in Scene 6

  // Scene 6: Wordmark
  const wordmarkOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const wordmarkTranslate = useRef(new Animated.Value(prefersReducedMotion ? 0 : 15)).current;

  // Scene 7: Tagline
  const taglineOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const taglineTranslate = useRef(new Animated.Value(prefersReducedMotion ? 0 : 15)).current;

  // Scene 8: Hero Headline
  const heroHeadlineOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const heroHeadlineTranslate = useRef(new Animated.Value(prefersReducedMotion ? 0 : 20)).current;

  // Scene 9: Supporting Copy
  const copyOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const copyTranslate = useRef(new Animated.Value(prefersReducedMotion ? 0 : 20)).current;

  // Scene 10: Buttons & Footer
  const buttonsOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const buttonsTranslate = useRef(new Animated.Value(prefersReducedMotion ? 0 : 20)).current;
  const footerOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion) return;

    Animated.sequence([
      // 0-1s: Scene 1 (Dot)
      Animated.parallel([
        Animated.timing(dotOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(dotScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
      // 1-2s: Scene 2 (Ripples)
      Animated.parallel([
        Animated.timing(ripple1Opacity, { toValue: 0.6, duration: 500, useNativeDriver: true }),
        Animated.timing(ripple1Scale, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(ripple2Opacity, { toValue: 0.4, duration: 500, useNativeDriver: true }),
            Animated.timing(ripple2Scale, { toValue: 2.2, duration: 700, useNativeDriver: true }),
          ]),
        ]),
      ]),
      // 2-4s: Scene 3 (Network Avatars fade in, hold)
      Animated.timing(networkOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.delay(1000), // Hold for 1 second

      // 4-5s: Scene 4 (Transform to Icons)
      Animated.parallel([
        Animated.timing(networkOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(ripple1Opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(ripple2Opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(iconsOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),

      // 5-6s: Scene 5 (Icons spiral inward, Logo appears)
      Animated.parallel([
        Animated.timing(iconsRotate, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(iconsScale, { toValue: 0, duration: 1000, useNativeDriver: true }),
        Animated.timing(iconsOpacity, { toValue: 0, duration: 1000, useNativeDriver: true }), // fade out
        Animated.timing(logoOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),

      // 6-7s: Scene 6 (Logo pulse, Wordmark reveal)
      Animated.parallel([
        Animated.sequence([
          Animated.timing(logoPulse, { toValue: 1.1, duration: 200, useNativeDriver: true }),
          Animated.timing(logoPulse, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(300),
          Animated.parallel([
            Animated.timing(wordmarkOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(wordmarkTranslate, { toValue: 0, duration: 700, useNativeDriver: true }),
          ])
        ])
      ]),

      // 7-8s: Scene 7 (Tagline)
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(taglineTranslate, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),

      // 8-9s: Scene 8 (Headline)
      Animated.parallel([
        Animated.timing(heroHeadlineOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(heroHeadlineTranslate, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),

      // 9-10s: Scene 9 (Supporting copy)
      Animated.parallel([
        Animated.timing(copyOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(copyTranslate, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),

      // 10-11s: Scene 10 (Buttons, nav, footer)
      Animated.parallel([
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(buttonsTranslate, { toValue: 0, duration: 1000, useNativeDriver: true }),
        Animated.timing(footerOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(navOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const spiralRotation = iconsRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Navigation Bar (Scene 10) */}
      <Animated.View style={[styles.navBar, { opacity: navOpacity }]} pointerEvents={prefersReducedMotion ? 'auto' : 'none'}>
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/syncora-icon-only.png')} style={styles.navLogo} />
          <Text style={styles.navBrand}>SYNCORA</Text>
        </View>
        <View style={styles.navActions}>
          {isWideScreen && (
            <TouchableOpacity style={styles.navLoginBtn} onPress={() => navigation.navigate('Auth')}>
              <Text style={styles.navLoginText}>Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        
        {/* The Graphic / Logo Area */}
        <View style={styles.graphicArea}>
          {/* Scene 1: Dot */}
          <Animated.View style={[styles.centerDot, { opacity: dotOpacity, transform: [{scale: dotScale}] }]} />
          
          {/* Scene 2: Ripples */}
          <Animated.View style={[styles.ripple, { opacity: ripple1Opacity, transform: [{scale: ripple1Scale}] }]} />
          <Animated.View style={[styles.ripple, { opacity: ripple2Opacity, transform: [{scale: ripple2Scale}] }]} />

          {/* Scene 3: Network Avatars & Lines */}
          <Animated.View style={[styles.networkContainer, { opacity: networkOpacity }]}>
             <View style={styles.networkLine1} />
             <View style={styles.networkLine2} />
             <View style={styles.networkLine3} />
             <View style={styles.avatar1} />
             <View style={styles.avatar2} />
             <View style={styles.avatar3} />
             <View style={styles.avatar4} />
          </Animated.View>

          {/* Scene 4: Icons (spiral inward) */}
          <Animated.View style={[styles.iconsContainer, { 
             opacity: iconsOpacity, 
             transform: [{ rotate: spiralRotation }, { scale: iconsScale }] 
          }]}>
             <Text style={styles.floatingIcon1}>📹</Text>
             <Text style={styles.floatingIcon2}>📍</Text>
             <Text style={styles.floatingIcon3}>💬</Text>
             <Text style={styles.floatingIcon4}>📅</Text>
          </Animated.View>

          {/* Scene 5 & 6: Syncora Logo */}
          <Animated.View style={[styles.logoGraphicContainer, {
             opacity: logoOpacity,
             transform: [{ scale: logoScale }, { scale: logoPulse }]
          }]}>
             <Image source={require('../../assets/syncora-icon-only.png')} style={styles.mainLogo} />
          </Animated.View>
        </View>

        {/* Text Area (Below the graphic) */}
        <View style={styles.textArea}>
           <Animated.Text style={[styles.wordmark, { opacity: wordmarkOpacity, transform: [{translateY: wordmarkTranslate}] }]}>SYNCORA</Animated.Text>
           <Animated.Text style={[styles.tagline, { opacity: taglineOpacity, transform: [{translateY: taglineTranslate}] }]}>Connect. Coordinate. Show up.</Animated.Text>
           
           <Animated.Text style={[styles.heroHeadline, { opacity: heroHeadlineOpacity, transform: [{translateY: heroHeadlineTranslate}] }]}>
             Meet people. Make plans. Build community.
           </Animated.Text>
           
           <Animated.Text style={[styles.copyText, { opacity: copyOpacity, transform: [{translateY: copyTranslate}] }]}>
             Discover events, groups, and people around the things you love—then show up and connect in real life.
           </Animated.Text>

           {/* Scene 10: Buttons */}
           <Animated.View style={[styles.buttonsContainer, { opacity: buttonsOpacity, transform: [{translateY: buttonsTranslate}] }]}>
             <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}>
                <Text style={styles.primaryButtonText}>Explore meetups</Text>
             </TouchableOpacity>
             <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Auth', { initialMode: 'register' })}>
                <Text style={styles.secondaryButtonText}>Create a meetup</Text>
             </TouchableOpacity>
           </Animated.View>
        </View>

      </View>

      {/* Scene 10 Footer / Illustration (particles) */}
      <Animated.View style={[styles.footerIllustration, { opacity: footerOpacity }]} pointerEvents="none">
         <View style={styles.footerParticle1} />
         <View style={styles.footerParticle2} />
         <View style={styles.footerParticle3} />
         {/* Subtle glow at the bottom */}
         <View style={styles.bottomGlow} />
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050002', // Deep black
    overflow: 'hidden',
  },
  // Navbar
  navBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
    zIndex: 100,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLogo: {
    width: 24,
    height: 24,
    marginRight: 12,
    resizeMode: 'contain',
  },
  navBrand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#FFFFFF',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navLoginBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  navLoginText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Content Area
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingTop: 60,
  },

  // Graphic Area (Animations)
  graphicArea: {
    height: 160,
    width: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerDot: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF6B9E',
    ...(Platform.OS === 'web' && { filter: 'drop-shadow(0px 0px 10px #FF6B9E)' }),
  },
  ripple: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: '#FF6B9E',
  },
  networkContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  avatar1: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: '#FCE7EF', top: 20, left: 30 },
  avatar2: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B9E', top: 120, left: 140 },
  avatar3: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#E91E63', top: 30, left: 160 },
  avatar4: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', top: 130, left: 40 },
  networkLine1: { position: 'absolute', width: 60, height: 1, backgroundColor: 'rgba(255, 107, 158, 0.3)', transform: [{rotate: '45deg'}], top: 50, left: 40 },
  networkLine2: { position: 'absolute', width: 80, height: 1, backgroundColor: 'rgba(255, 107, 158, 0.3)', transform: [{rotate: '-20deg'}], top: 80, left: 80 },
  networkLine3: { position: 'absolute', width: 70, height: 1, backgroundColor: 'rgba(255, 107, 158, 0.3)', transform: [{rotate: '70deg'}], top: 70, left: 100 },
  
  iconsContainer: { position: 'absolute', width: 160, height: 160, justifyContent: 'center', alignItems: 'center' },
  floatingIcon1: { position: 'absolute', fontSize: 18, top: 10, left: 30 },
  floatingIcon2: { position: 'absolute', fontSize: 18, bottom: 10, right: 30 },
  floatingIcon3: { position: 'absolute', fontSize: 18, top: 50, right: 10 },
  floatingIcon4: { position: 'absolute', fontSize: 18, bottom: 40, left: 10 },

  logoGraphicContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  mainLogo: { width: 90, height: 90, resizeMode: 'contain', ...(Platform.OS === 'web' && { filter: 'drop-shadow(0px 10px 20px rgba(233, 30, 99, 0.4))' }) },

  // Text Area
  textArea: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  wordmark: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 4, marginTop: 16, textAlign: 'center' },
  tagline: { color: '#FF6B9E', fontSize: 12, fontWeight: '600', letterSpacing: 2, marginTop: 6, textAlign: 'center', textTransform: 'uppercase' },
  heroHeadline: { color: '#FFFFFF', fontSize: isWideScreen ? 56 : 38, fontWeight: '800', textAlign: 'center', marginTop: 32, maxWidth: 800, lineHeight: isWideScreen ? 64 : 46 },
  copyText: { color: 'rgba(255, 255, 255, 0.6)', fontSize: isWideScreen ? 20 : 16, textAlign: 'center', marginTop: 24, maxWidth: 600, lineHeight: 28 },
  
  // Buttons
  buttonsContainer: { flexDirection: isWideScreen ? 'row' : 'column', gap: 16, marginTop: 40, width: isWideScreen ? 'auto' : '100%', maxWidth: 400 },
  primaryButton: { backgroundColor: '#E91E63', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, alignItems: 'center', ...(Platform.OS === 'web' && { filter: 'drop-shadow(0px 4px 15px rgba(233, 30, 99, 0.4))' }) },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  secondaryButton: { backgroundColor: 'transparent', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, borderWidth: 2, borderColor: '#FF6B9E', alignItems: 'center' },
  secondaryButtonText: { color: '#FF6B9E', fontSize: 16, fontWeight: 'bold' },

  // Footer / Particles
  footerIllustration: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  bottomGlow: { position: 'absolute', bottom: -height * 0.2, left: -width * 0.2, width: width * 1.4, height: height * 0.4, borderRadius: 9999, backgroundColor: '#E91E63', opacity: 0.1, ...(Platform.OS === 'web' && { filter: 'blur(150px)' }) },
  footerParticle1: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF6B9E', bottom: 100, left: '20%', opacity: 0.4 },
  footerParticle2: { position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', bottom: 150, right: '25%', opacity: 0.3 },
  footerParticle3: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#E91E63', bottom: 80, right: '10%', opacity: 0.5 },
});
