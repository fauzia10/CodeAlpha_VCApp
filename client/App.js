import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import { RoomProvider } from './src/context/RoomContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <AuthProvider>
        <RoomProvider>
          <AppNavigator />
          <StatusBar style="light" />
        </RoomProvider>
      </AuthProvider>
    </NavigationContainer>
  );
}
