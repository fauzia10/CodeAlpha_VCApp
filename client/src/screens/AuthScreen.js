import React, { useState, useContext } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Dimensions
} from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function AuthScreen({ route }) {
  const initialMode = route?.params?.initialMode;
  const [isLogin, setIsLogin] = useState(initialMode !== 'register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, register } = useContext(AuthContext);

  const handleSubmit = async () => {
    setErrorMsg('');
    if (!email || !password) {
      setErrorMsg('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      result = await register(email.split('@')[0], email, password);
    }
    setIsSubmitting(false);

    if (result && !result.success) {
      setErrorMsg(result.error || 'Authentication failed. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Particles */}
      <View style={styles.bgParticles} pointerEvents="none">
        <View style={[styles.particle, { top: '10%', left: '20%', width: 4, height: 4, opacity: 0.3 }]} />
        <View style={[styles.particle, { top: '30%', right: '15%', width: 6, height: 6, opacity: 0.5 }]} />
        <View style={[styles.particle, { bottom: '20%', left: '10%', width: 8, height: 8, opacity: 0.2 }]} />
        <View style={[styles.particle, { bottom: '40%', right: '25%', width: 5, height: 5, opacity: 0.4 }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.logoContainer}>
             <Image source={require('../../assets/syncora-icon-only.png')} style={styles.logo} />
          </View>

          <Text style={styles.title}>{isLogin ? 'Welcome back' : 'Create an account'}</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Sign in to connect with your community.' : 'Join your community today.'}
          </Text>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {isLogin && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{isLogin ? 'Sign in' : 'Sign up'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.toggleLink} onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.toggleLinkText}>
                {isLogin ? 'New to Syncora? Create an account' : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050002' },
  bgParticles: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  particle: { position: 'absolute', borderRadius: 999, backgroundColor: '#FF6B9E', ...(Platform.OS === 'web' && { filter: 'drop-shadow(0px 0px 4px #FF6B9E)' }) },
  keyboardView: { flex: 1, zIndex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  logoContainer: { marginBottom: 32 },
  logo: { width: 56, height: 56, resizeMode: 'contain', ...(Platform.OS === 'web' && { filter: 'drop-shadow(0px 4px 12px rgba(233, 30, 99, 0.4))' }) },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 40, textAlign: 'center' },
  errorText: { color: '#FF6B9E', backgroundColor: 'rgba(233, 30, 99, 0.1)', padding: 12, borderRadius: 8, marginBottom: 20, width: '100%', maxWidth: 400, textAlign: 'center' },
  formContainer: { width: '100%', maxWidth: 400 },
  inputWrapper: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,107,158,0.3)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#FFFFFF', fontSize: 16 },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotPasswordText: { color: '#FF6B9E', fontSize: 14, fontWeight: '600' },
  submitButton: { backgroundColor: '#E91E63', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, ...(Platform.OS === 'web' && { filter: 'drop-shadow(0px 4px 15px rgba(233, 30, 99, 0.4))' }) },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  toggleLink: { marginTop: 32, alignItems: 'center' },
  toggleLinkText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
});
