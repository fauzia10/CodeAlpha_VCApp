import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  Platform,
  useColorScheme,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// Detect prefers-reduced-motion on web
const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sparkle particle component
function Sparkle({ delay, x, y, size, duration }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prefersReducedMotion) {
      opacity.setValue(0.6);
      scale.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: duration * 0.4,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: duration * 0.6,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
  }, []);

  return (
    <Animated.Text
      style={[
        styles.sparkle,
        {
          left: x,
          top: y,
          fontSize: size,
          opacity,
          transform: [{ scale }],
        },
      ]}
    >
      ✦
    </Animated.Text>
  );
}

// Sparkle config — pre-calculated positions
const SPARKLES = [
  { delay: 300,  x: width * 0.18, y: height * 0.28, size: 14, duration: 1200 },
  { delay: 500,  x: width * 0.75, y: height * 0.22, size: 10, duration: 1000 },
  { delay: 700,  x: width * 0.82, y: height * 0.55, size: 16, duration: 1400 },
  { delay: 400,  x: width * 0.12, y: height * 0.62, size: 12, duration: 1100 },
  { delay: 900,  x: width * 0.55, y: height * 0.18, size: 8,  duration: 900  },
  { delay: 600,  x: width * 0.68, y: height * 0.72, size: 13, duration: 1300 },
  { delay: 1000, x: width * 0.25, y: height * 0.78, size: 9,  duration: 1000 },
];

export default function SplashScreen({ onDone }) {
  const isDark = useColorScheme() === 'dark';
  // Logo animations
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0.72)).current;
  const floatAnim  = useRef(new Animated.Value(0)).current;
  // Text animations (stagger after logo)
  const textFade   = useRef(new Animated.Value(0)).current;
  const textSlide  = useRef(new Animated.Value(prefersReducedMotion ? 0 : 18)).current;
  // Subtitle
  const subFade    = useRef(new Animated.Value(0)).current;
  // Background glow pulse
  const glowPulse  = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip animations, just show content
      fadeAnim.setValue(1);
      textFade.setValue(1);
      subFade.setValue(1);
      glowPulse.setValue(1);
      return;
    }

    // 1. Logo fade + scale-up (0–700ms)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2. Floating loop (starts after logo appears)
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: -10,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });

    // 3. Title text slides up + fades in (starts at 500ms)
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(textFade, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 4. Subtitle fades in at 900ms
    Animated.sequence([
      Animated.delay(900),
      Animated.timing(subFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // 5. Background glow softly pulses
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.6,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Background gradient layers */}
      <View style={styles.bgBase} />
      <Animated.View style={[styles.bgGlow, { opacity: glowPulse }]} />
      <View style={styles.bgGlow2} />

      {/* Sparkle particles */}
      {SPARKLES.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: fadeAnim,
            transform: [
              { scale: scaleAnim },
              { translateY: floatAnim },
            ],
          },
        ]}
      >
        <View style={styles.logoGlowRing}>
          <Image
            source={isDark ? require('../../assets/syncora-logo-dark.png') : require('../../assets/syncora-logo-light.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* Brand title */}
      <Animated.Text
        style={[
          styles.title,
          {
            opacity: textFade,
            transform: [{ translateY: textSlide }],
          },
        ]}
      >
        Syncora
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: subFade }]}>
        Meet beautifully. Create together.
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },

  // Background layers — layered to simulate a blush gradient
  bgBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF0F4',
  },
  bgGlow: {
    position: 'absolute',
    top: -height * 0.15,
    left: -width * 0.2,
    width: width * 1.4,
    height: height * 0.75,
    borderRadius: 9999,
    backgroundColor: '#F7B6C8',
    opacity: 0.35,
    ...(Platform.OS === 'web' && { filter: 'blur(80px)' }),
  },
  bgGlow2: {
    position: 'absolute',
    bottom: -height * 0.1,
    right: -width * 0.1,
    width: width * 0.8,
    height: height * 0.5,
    borderRadius: 9999,
    backgroundColor: '#FCE7EF',
    opacity: 0.5,
    ...(Platform.OS === 'web' && { filter: 'blur(60px)' }),
  },

  // Sparkle
  sparkle: {
    position: 'absolute',
    color: '#E989A6',
    fontWeight: 'bold',
  },

  // Logo
  logoWrapper: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlowRing: {
    width: 152,
    height: 152,
    borderRadius: 76,
    backgroundColor: 'rgba(247,182,200,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(233,137,166,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' && {
      boxShadow: '0 0 60px rgba(247,182,200,0.45), 0 0 120px rgba(247,182,200,0.2)',
    }),
  },
  logo: {
    width: 110,
    height: 110,
  },

  // Text
  title: {
    fontSize: 46,
    fontWeight: '900',
    color: '#3D2630',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    color: '#E989A6',
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginHorizontal: 40,
    lineHeight: 22,
  },
});
