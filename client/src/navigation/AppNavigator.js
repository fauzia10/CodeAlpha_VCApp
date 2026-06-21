import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { RoomContext } from '../context/RoomContext';
import LandingScreen from '../screens/LandingScreen';
import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import RoomScreen from '../screens/RoomScreen';
import { COLORS } from '../theme/colors';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { token, isLoading } = useContext(AuthContext);
  const { roomId } = useContext(RoomContext);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#050002' },
        // Smooth fade transition between screens
        animation: 'fade',
      }}
    >
      {token === null ? (
        // Unauthenticated Flow: Landing -> Auth
        <Stack.Group>
          <Stack.Screen name="Landing" component={LandingScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Group>
      ) : roomId === null ? (
        // Authenticated but not in a Room
        <Stack.Screen name="Home" component={HomeScreen} />
      ) : (
        // Active Collaboration Call Room
        <Stack.Screen name="Room" component={RoomScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050002',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
