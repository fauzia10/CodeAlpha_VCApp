import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Platform } from 'react-native';

const prefersReducedMotion =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SplashScreen() {
  const dotOpacity = useRef(new Animated.Value(prefersReducedMotion ? 0 : 0)).current;
  const ripple1Scale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const ripple1Opacity = useRef(new Animated.Value(prefersReducedMotion ? 0 : 0)).current;
  const ripple2Scale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const ripple2Opacity = useRef(new Animated.Value(prefersReducedMotion ? 0 : 0)).current;

  // Since we don't have sweeping paths, we emulate with 2 semi circles
  const trail1Rot = useRef(new Animated.Value(prefersReducedMotion ? 0 : -180)).current;
  const trail2Rot = useRef(new Animated.Value(prefersReducedMotion ? 0 : 180)).current;
  const trailsOpacity = useRef(new Animated.Value(prefersReducedMotion ? 0 : 0)).current;

  const logoOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const logoScale = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0.2)).current;
  const logoPulse = useRef(new Animated.Value(1)).current;
  const logoGlow = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;

  const textOpacity = useRef(new Animated.Value(prefersReducedMotion ? 1 : 0)).current;
  const textTranslate = useRef(new Animated.Value(prefersReducedMotion ? 0 : 15)).current;

  const entireTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prefersReducedMotion) return;

    Animated.sequence([
      // 0.0 - 1.0s: Dot and ripples
      Animated.parallel([
        Animated.timing(dotOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(ripple1Opacity, { toValue: 0.6, duration: 400, useNativeDriver: true }),
            Animated.timing(ripple1Scale, { toValue: 1, duration: 800, useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(400),
          Animated.parallel([
            Animated.timing(ripple2Opacity, { toValue: 0.4, duration: 400, useNativeDriver: true }),
            Animated.timing(ripple2Scale, { toValue: 1.5, duration: 600, useNativeDriver: true }),
          ]),
        ])
      ]),

      // 1.0 - 2.5s: Trails sweep and logo appears
      Animated.parallel([
        Animated.timing(ripple1Opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(ripple2Opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        
        Animated.timing(trailsOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(trail1Rot, { toValue: 0, duration: 1500, useNativeDriver: true }),
        Animated.timing(trail2Rot, { toValue: 0, duration: 1500, useNativeDriver: true }),
        Animated.timing(trailsOpacity, { toValue: 0, duration: 1000, delay: 500, useNativeDriver: true }),

        Animated.timing(logoOpacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 20, useNativeDriver: true }),
        
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(logoPulse, { toValue: 1.15, duration: 150, useNativeDriver: true }),
          Animated.timing(logoPulse, { toValue: 1, duration: 150, useNativeDriver: true }),
        ])
      ]),

      // 2.5 - 3.2s: Glow, Text reveal
      Animated.parallel([
        Animated.timing(logoGlow, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(textTranslate, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),

      // 3.2 - 4.0s: Upward fade transition
      Animated.parallel([
        Animated.timing(entireTranslateY, { toValue: -30, duration: 800, useNativeDriver: true }),
        // Opacity fade is handled by App.js wrapper over 800ms
      ]),
    ]).start();
  }, []);

  const t1Rot = trail1Rot.interpolate({ inputRange: [-180, 0], outputRange: ['-180deg', '0deg'] });
  const t2Rot = trail2Rot.interpolate({ inputRange: [180, 0], outputRange: ['180deg', '0deg'] });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { transform: [{ translateY: entireTranslateY }] }]}>
        
        <View style={styles.graphicArea}>
          <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
          <Animated.View style={[styles.ripple, { opacity: ripple1Opacity, transform: [{scale: ripple1Scale}] }]} />
          <Animated.View style={[styles.ripple, { opacity: ripple2Opacity, transform: [{scale: ripple2Scale}] }]} />

          <Animated.View style={[styles.trail, styles.trailLeft, { opacity: trailsOpacity, transform: [{rotate: t1Rot}] }]} />
          <Animated.View style={[styles.trail, styles.trailRight, { opacity: trailsOpacity, transform: [{rotate: t2Rot}] }]} />

          <Animated.View style={[styles.logoWrapper, { opacity: logoOpacity, transform: [{scale: logoScale}, {scale: logoPulse}] }]}>
             <Animated.View style={[styles.glow, { opacity: logoGlow }]} />
             <Image source={require('../../assets/syncora-icon-only.png')} style={styles.logoImage} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.textArea, { opacity: textOpacity, transform: [{translateY: textTranslate}] }]}>
           <Text style={styles.wordmark}>SYNCORA</Text>
           <Text style={styles.tagline}>Connect. Coordinate. Show up.</Text>
        </Animated.View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050002', justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center' },
  graphicArea: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center' },
  dot: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: '#FF6B9E' },
  ripple: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#FF6B9E' },
  trail: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderTopWidth: 8, borderColor: '#E91E63' },
  trailLeft: { borderLeftWidth: 8, opacity: 0.5 },
  trailRight: { borderRightWidth: 8, opacity: 0.5 },
  logoWrapper: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  glow: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#FF6B9E', ...(Platform.OS==='web' && { filter: 'blur(30px)' }) },
  logoImage: { width: 100, height: 100, resizeMode: 'contain' },
  textArea: { alignItems: 'center', marginTop: 24 },
  wordmark: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  tagline: { color: '#FF6B9E', fontSize: 12, fontWeight: '600', letterSpacing: 1.5, marginTop: 8, textTransform: 'uppercase' },
});
