import React, { useState, useEffect, useRef } from 'react';
import { Platform, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { RoomProvider } from './src/context/RoomContext';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

// Duration of the full splash display (ms)
const SPLASH_DURATION = 2800;

/**
 * Check/set the "splash shown" flag in sessionStorage (web) or app state (native).
 * Returns true if we should skip the splash this session.
 */
const SPLASH_SESSION_KEY = 'syncora_splash_seen';

function checkSplashShown() {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(SPLASH_SESSION_KEY) === '1';
  }
  return false; // On native, always show on cold start
}

function markSplashShown() {
  if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1');
  }
}

export default function App() {
  // Skip splash if already shown this session
  const alreadyShown = checkSplashShown();
  const [showSplash, setShowSplash] = useState(!alreadyShown);
  // Fade out the splash before unmounting
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Syncora';
    }
  }, []);

  useEffect(() => {
    if (!showSplash) return;

    const timer = setTimeout(() => {
      // Mark as shown so future navigations within the same browser tab skip it
      markSplashShown();

      // Fade the splash out over 400ms before hiding it
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, [showSplash]);

  return (
    <AuthProvider>
      <RoomProvider>
        {/* Main app — rendered behind the splash so it loads while splash plays */}
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="light" />
        </NavigationContainer>

        {/* Splash overlaid on top, fades out */}
        {showSplash && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: splashOpacity,
              zIndex: 9999,
            }}
            pointerEvents={showSplash ? 'auto' : 'none'}
          >
            <SplashScreen />
          </Animated.View>
        )}
      </RoomProvider>
    </AuthProvider>
  );
}
