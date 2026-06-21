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
  // Background is fully opaque from the start to prevent underlying screens from flashing
  
  // Icon (0.3s - 1.0s)
  const iconOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const iconScale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0.75)).current;
  const iconFloat = useRef(new Animated.Value(0)).current;

  // Connection Dots & Collaboration Icons (1.2s - 2.0s)
  const collabOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const dotsRotate = useRef(new Animated.Value(0)).current;

  // Text / Wordmark letters
  const letterAnimations = useRef(
    'Syncora'.split('').map(() => new Animated.Value(prefersReducedMotion ? 1 : 0))
  ).current;
  const taglineOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  // Entire Container Scale Down (Not required in new spec, App.js handles the opacity fade at 2.8s)

  useEffect(() => {
    if (prefersReducedMotion) return;

    // 0.3s - 1.0s: Icon fade + scale + float
    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.timing(iconOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(iconFloat, { toValue: -5, duration: 1500, useNativeDriver: true }),
          Animated.timing(iconFloat, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    });

    // 0.8s: Letters fade up one by one
    Animated.sequence([
      Animated.delay(800),
      Animated.stagger(
        70, // delay between each letter
        letterAnimations.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          })
        )
      ),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    // 1.2s - 2.0s: Collaboration animations fade in then out softly
    Animated.sequence([
      Animated.delay(1200),
      Animated.parallel([
        Animated.timing(collabOpacity, { toValue: 0.8, duration: 400, useNativeDriver: true }),
        Animated.timing(dotsRotate, { toValue: 1, duration: 1600, useNativeDriver: true }),
      ]),
      Animated.delay(200), // hold
      Animated.timing(collabOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    
    // 2.0s - 2.8s: Handled by App.js (fades out the entire screen component)
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
    <Animated.View style={[styles.root, { backgroundColor: bgColor }]}>
      
      {/* Background soft grain / glows */}
      <View style={[styles.bgGlow, { backgroundColor: isDark ? '#2E1521' : '#FCE7EF' }]} />
      
      <View style={styles.centerStage}>
        {/* Collaboration Icons & Dots (orbiting the icon) */}
        <Animated.View style={[styles.dotsContainer, { opacity: collabOpacity, transform: [{ rotate: spin }] }]}>
          <View style={[styles.dot, styles.dot1, { backgroundColor: isDark ? '#E989A6' : '#F7B6C8' }]} />
          <View style={[styles.dot, styles.dot2, { backgroundColor: isDark ? '#E989A6' : '#F7B6C8' }]} />
          <View style={[styles.dot, styles.dot3, { backgroundColor: isDark ? '#E989A6' : '#F7B6C8' }]} />
          
          {/* Tiny Action Icons */}
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
          Meet beautifully. Create together.
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
