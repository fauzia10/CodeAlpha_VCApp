import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const saveSecurely = async (key, value) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const getSecurely = async (key) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return null;
  }
  return await SecureStore.getItemAsync(key);
};

const deleteSecurely = async (key) => {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

export const AuthContext = createContext();

const TOKEN_KEY = 'user_jwt_token';
const USER_KEY = 'user_profile_data';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load token and user from SecureStore on startup, then validate against server
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const storedToken = await getSecurely(TOKEN_KEY);
        const storedUser = await getSecurely(USER_KEY);

        if (storedToken && storedUser) {
          // Validate the token is still accepted by the server
          try {
            const validation = await fetch(`${API_URL}/api/auth/profile`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${storedToken}` },
            });

            if (validation.ok) {
              // Token is valid — restore session
              setToken(storedToken);
              setUser(JSON.parse(storedUser));
            } else {
              // Token rejected (server restarted, account deleted, expired)
              console.log('Stored token is no longer valid — clearing old credentials.');
              await deleteSecurely(TOKEN_KEY);
              await deleteSecurely(USER_KEY);
            }
          } catch (_networkErr) {
            // Server unreachable — still restore session optimistically
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
          }
        }
      } catch (e) {
        console.error('Failed to load credentials from storage', e);
        // Clear potentially corrupted data
        await deleteSecurely(TOKEN_KEY);
        await deleteSecurely(USER_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  // Register logic
  const register = async (username, email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      await login(email, password);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Login logic
  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const { token, user: userProfile } = data;
      setToken(token);
      setUser(userProfile);

      // Save securely
      await saveSecurely(TOKEN_KEY, token);
      await saveSecurely(USER_KEY, JSON.stringify(userProfile));

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Logout logic
  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      await deleteSecurely(TOKEN_KEY);
      await deleteSecurely(USER_KEY);
    } catch (e) {
      console.error('Failed to delete credentials from storage', e);
    }
  };

  // Theme Mode (dark | light)
  const [themeMode, setThemeMode] = useState('dark');

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        register,
        login,
        logout,
        themeMode,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
