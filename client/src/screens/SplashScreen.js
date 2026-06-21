import React, { useEffect, useRef, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Platform,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

// Detect prefers-reduced-motion on web
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SplashScreen() {
  const { themeMode } = useContext(AuthContext);
  const isDark = themeMode === 'dark';

  // --- Animation Values ---
  // Background (0.0s - 0.3s)
  const bgOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  
  // Icon (0.2s - 0.8s)
  const iconOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const iconScale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0.82)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;

  // Connection Dots (0.7s - 1.3s)
  const dotsOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const dotsRotate = useRef(new Animated.Value(0)).current;

  // Text / Wordmark (1.0s - 1.7s)
  const textOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const textTranslateY = useRef(new Animated.Value(prefersReducedMotion ? 0 : 15)).current;

  // Tiny Action Icons (1.7s - 2.3s)
  const tinyIconsOpacity = useRef(new Animated.Value(0)).current; // they fade in then out

  // Entire Container Scale Down (2.3s - 2.7s)
  const containerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (prefersReducedMotion) return;

    // 0.0s - 0.3s: Background fade
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // 0.2s - 0.8s: Icon fade + scale
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Start floating motion after it appears
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconFloat, { toValue: -8, duration: 1500, useNativeDriver: true }),
          Animated.timing(iconFloat, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    });

    // 0.7s - 1.3s: Connection Dots
    Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(dotsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotsRotate, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    ]).start();

    // 1.0s - 1.7s: Wordmark & Tagline
    Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(textTranslateY, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();

    // 1.7s - 2.3s: Tiny joining room icons (fade in then out)
    Animated.sequence([
      Animated.delay(1700),
      Animated.timing(tinyIconsOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(tinyIconsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    // 2.3s - 2.7s: Entire splash screen gently scales down
    Animated.sequence([
      Animated.delay(2300),
      Animated.timing(containerScale, {
        toValue: 0.95,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const spin = dotsRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'], // Subtle rotation
  });

  // Colors based on theme
  const bgColor = isDark ? '#110A0D' : '#FFF5F8'; // Deep plum/black vs pale blush
  const textColor = isDark ? '#F7D6E0' : '#3D2630';
  const taglineColor = isDark ? 'rgba(247,182,200,0.7)' : 'rgba(233,137,166,1)';

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor, opacity: bgOpacity, transform: [{ scale: containerScale }] }]}>
      
      {/* Background soft grain / glows */}
      <View style={[styles.bgGlow, { backgroundColor: isDark ? '#2E1521' : '#FCE7EF' }]} />
      
      <View style={styles.centerStage}>
        {/* Connection Dots (orbiting the icon) */}
        <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity, transform: [{ rotate: spin }] }]}>
          <View style={[styles.dot, styles.dot1, { backgroundColor: isDark ? '#E989A6' : '#F7B6C8' }]} />
          <View style={[styles.dot, styles.dot2, { backgroundColor: isDark ? '#E989A6' : '#F7B6C8' }]} />
          <View style={[styles.dot, styles.dot3, { backgroundColor: isDark ? '#E989A6' : '#F7B6C8' }]} />
        </Animated.View>

        {/* Tiny Action Icons */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: tinyIconsOpacity }]}>
          <Text style={[styles.tinyIcon, styles.tinyIcon1]}>💬</Text>
          <Text style={[styles.tinyIcon, styles.tinyIcon2]}>🎥</Text>
          <Text style={[styles.tinyIcon, styles.tinyIcon3]}>✨</Text>
        </Animated.View>

        {/* Syncora Icon */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              opacity: iconOpacity,
              transform: [{ scale: iconScale }, { translateY: iconFloat }],
            },
          ]}
        >
          <View style={styles.iconGlow} />
          <Image
            source={require('../../assets/syncora-icon-only.png')}
            style={styles.iconImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Wordmark & Tagline */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          },
        ]}
      >
        <Text style={[styles.wordmark, { color: textColor }]}>Syncora</Text>
        <Text style={[styles.tagline, { color: taglineColor }]}>Meet beautifully. Create together.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    width: width * 1.5,
    height: height * 0.8,
    borderRadius: 9999,
    opacity: 0.4,
    ...(Platform.OS === 'web' && { filter: 'blur(100px)' }),
  },
  centerStage: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  // Dots
  dotsContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dot1: { top: 10, left: 40 },
  dot2: { bottom: 30, right: 20 },
  dot3: { top: 70, right: 10 },
  
  // Tiny Icons
  tinyIcon: {
    position: 'absolute',
    fontSize: 16,
  },
  tinyIcon1: { top: 10, right: 30 },
  tinyIcon2: { bottom: 20, left: 30 },
  tinyIcon3: { top: 40, left: 20 },

  // Icon
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(233,137,166,0.15)',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 50px rgba(247,182,200,0.5)',
    }),
  },
  iconImage: {
    width: 120,
    height: 120,
  },

  // Text
  textContainer: {
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
