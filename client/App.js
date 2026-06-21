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

export default function App() {
  // Always show splash on startup (refresh resets state)
  const [showSplash, setShowSplash] = useState(true);
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
