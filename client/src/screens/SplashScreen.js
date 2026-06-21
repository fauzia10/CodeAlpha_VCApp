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
  
  // Cinematic colors
  const bgColor = '#050002'; // Deep black for cinematic feel
  const textColor = '#FFFFFF';
  const taglineColor = 'rgba(255, 255, 255, 0.7)';

  // --- Animation Values ---
  // 1. Central Pink Glow
  const glowOpacity = useRef(new Animated.Value(prefersReducedMotion ? 0.3 : 0)).current;
  
  // 2. Logo Assembly (simulate sweep)
  const logoOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0.4)).current;
  const logoRotate = useRef(new Animated.Value(prefersReducedMotion ? 0 : -1)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;

  // 3. Dots Orbit
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const dotsRotate = useRef(new Animated.Value(0)).current;

  // 4. Wordmark & Tagline
  const letterAnimations = useRef(
    'Syncora'.split('').map(() => new Animated.Value(prefersReducedMotion ? 1 : 0))
  ).current;
  const taglineOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion) return;

    // 1. Soft Pink Glow Appears (0s - 1.5s)
    Animated.timing(glowOpacity, {
      toValue: 0.3, // Soft ambient glow
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // 2. Logo Sweeps In (1.0s - 2.5s)
    Animated.sequence([
      Animated.delay(1000),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 20, useNativeDriver: true }),
        Animated.timing(logoRotate, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
      // 3. Logo softly pulses once (2.8s - 3.4s)
      Animated.delay(300),
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1.05, duration: 300, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 1, duration: 300, useNativeDriver: true }),
      ])
    ]).start();

    // 4. Glowing Dots Orbit (2.5s - 4.5s)
    Animated.sequence([
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(dotsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(dotsRotate, { toValue: 1, duration: 2500, useNativeDriver: true }),
      ]),
      Animated.timing(dotsOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    // 5. Text Reveal (4.0s - 5.0s)
    Animated.sequence([
      Animated.delay(4000),
      Animated.stagger(
        80,
        letterAnimations.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          })
        )
      ),
      // 6. Tagline Reveal (5.2s)
      Animated.delay(400),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();

  }, []);

  const spin = dotsRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'], // Orbit halfway around
  });

  const logoSpin = logoRotate.interpolate({
    inputRange: [-1, 0],
    outputRange: ['-60deg', '0deg'], // Sweep rotation
  });

  return (
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>
      
      {/* Background Glow */}
      <Animated.View style={[styles.bgGlow, { opacity: glowOpacity, backgroundColor: '#FF1493' }]} />
      
      <View style={styles.centerStage}>
        {/* Orbiting Dots */}
        <Animated.View style={[styles.dotsContainer, { opacity: dotsOpacity, transform: [{ rotate: spin }] }]}>
          <View style={[styles.dot, styles.dot1, { backgroundColor: '#FF6B9E', shadowColor: '#FF6B9E', shadowRadius: 12, shadowOpacity: 1 }]} />
          <View style={[styles.dot, styles.dot2, { backgroundColor: '#FF6B9E', shadowColor: '#FF6B9E', shadowRadius: 12, shadowOpacity: 1 }]} />
        </Animated.View>

        {/* Syncora Logo */}
        <Animated.View
          style={[
            styles.iconWrapper,
            {
              opacity: logoOpacity,
              transform: [
                { scale: logoScale },
                { rotate: logoSpin },
                { scale: logoPulse }
              ],
            },
          ]}
        >
          <Image
            source={require('../../assets/syncora-icon-only.png')}
            style={styles.iconImage}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Wordmark & Tagline */}
      <View style={styles.textContainer}>
        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
          {'Syncora'.split('').map((char, index) => {
            const letterOpacity = letterAnimations[index];
            const letterTranslateY = letterOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [15, 0],
            });

            return (
              <Animated.Text
                key={index}
                style={[
                  styles.wordmarkLetter,
                  { color: textColor, opacity: letterOpacity, transform: [{ translateY: letterTranslateY }] }
                ]}
              >
                {char}
              </Animated.Text>
            );
          })}
        </View>
        <Animated.Text style={[styles.tagline, { color: taglineColor, opacity: taglineOpacity }]}>
          Connect. Coordinate. Show up.
        </Animated.Text>
      </View>
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
    ...(Platform.OS === 'web' && { filter: 'blur(150px)' }),
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dot1: { top: 10, left: 40 },
  dot2: { bottom: 30, right: 20 },
  
  // Icon
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconImage: {
    width: 120,
    height: 120,
    ...(Platform.OS === 'web' && {
      filter: 'drop-shadow(0px 10px 20px rgba(255, 107, 158, 0.4))',
    }),
  },

  // Text
  textContainer: {
    alignItems: 'center',
  },
  wordmarkLetter: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
