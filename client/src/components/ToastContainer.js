import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { COLORS } from '../theme/colors';

const { width } = Dimensions.get('window');
const isWideScreen = width > 768;

const ToastItem = ({ toast, onRemove, onAction }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 300, useNativeDriver: true }),
      ]).start(() => onRemove(toast.id));
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, []);

  const handlePress = () => {
    if (toast.action) {
      onAction(toast.action);
    }
  };

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.toastContent}>
        {toast.icon && <Text style={styles.icon}>{toast.icon}</Text>}
        <Text style={styles.message}>{toast.message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ToastContainer = ({ toasts, onRemove, onAction }) => {
  return (
    <View style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} onAction={onAction} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: isWideScreen ? 20 : 60,
    right: isWideScreen ? 20 : undefined,
    alignSelf: isWideScreen ? 'flex-end' : 'center',
    zIndex: 9999,
    flexDirection: 'column',
    alignItems: isWideScreen ? 'flex-end' : 'center',
    gap: 10,
    pointerEvents: 'box-none',
  },
  toast: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 250,
    maxWidth: 350,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 10,
    fontSize: 18,
  },
  message: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
  },
});
