import React, { useState, useEffect, useRef } from 'react';
import { Platform, Animated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { RoomProvider } from './src/context/RoomContext';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

const SPLASH_DURATION = 4000;

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.title = 'Syncora';
    }
  }, []);

  useEffect(() => {
    if (!showSplash) return;

    const timer = setTimeout(() => {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 800, // Fades out exactly between 3.2s and 4.0s
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, SPLASH_DURATION - 800);

    return () => clearTimeout(timer);
  }, [showSplash]);

  return (
    <AuthProvider>
      <RoomProvider>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="light" />
        </NavigationContainer>

        {showSplash && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
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
