import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/apiHandler';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../utils/theme';

export default function LoginScreen({ navigation }) {
  const { login, loginWithToken } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [formError, setFormError] = useState('');

  const loginMutation = useMutation({
    mutationFn: (data) => authApi.login(data),
    onSuccess: (data) => {
      login(data.access_token, data.user);
    },
    onError: (err) => {
      setFormError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    },
  });

  const googleMutation = useMutation({
    mutationFn: () => authApi.getGoogleUrl(),
    onSuccess: async (data) => {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'tracelify://auth/callback'
      );
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        if (token) {
          await loginWithToken(token);
        }
      }
    },
    onError: () => setFormError('Failed to initiate Google login.'),
  });

  const handleSubmit = () => {
    setFormError('');
    if (!form.email || !form.password) {
      setFormError('Please fill in all fields.');
      return;
    }
    loginMutation.mutate(form);
  };

  return (
    <View style={styles.container}>
      {/* Background gradient blobs approximation */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Ionicons name="flash" size={24} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>Tracelify</Text>
            <Text style={styles.brandSub}>Production error tracking</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subHeading}>Sign in to your account</Text>

            {/* Google */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={() => googleMutation.mutate()}
              disabled={googleMutation.isPending}
              activeOpacity={0.7}
            >
              {googleMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Ionicons name="logo-google" size={18} color={COLORS.textPrimary} />
              )}
              <Text style={styles.googleText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Error */}
            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            />

            {/* Password */}
            <Text style={[styles.label, { marginTop: SPACING.md }]}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, { flex: 1, paddingRight: 44 }]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPwd}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPwd((v) => !v)}
              >
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loginMutation.isPending}
              activeOpacity={0.7}
            >
              {loginMutation.isPending && (
                <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
              )}
              <Text style={styles.submitText}>Sign in</Text>
            </TouchableOpacity>

            {/* Link */}
            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.linkAction}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  blobTop: {
    position: 'absolute', top: -120, left: -120,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  blobBottom: {
    position: 'absolute', bottom: -120, right: -120,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoWrap: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: COLORS.violet,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.violet, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  brandTitle: {
    fontSize: 22, fontWeight: '700',
    color: COLORS.textPrimary, marginTop: 10,
  },
  brandSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(30,41,59,0.6)',
    backgroundColor: 'rgba(15,23,42,0.6)',
    padding: 24,
  },
  heading: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  subHeading: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, marginBottom: 20 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.slate700, backgroundColor: 'rgba(30,41,59,0.6)',
    paddingVertical: 12, marginBottom: 16,
  },
  googleText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  divider: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.slate800 },
  dividerText: { fontSize: 11, color: COLORS.textDim },
  errorBox: {
    borderRadius: BORDER_RADIUS.sm, borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12, marginBottom: 12,
  },
  errorText: { fontSize: 13, color: COLORS.redText },
  label: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input: {
    borderRadius: BORDER_RADIUS.lg, borderWidth: 1,
    borderColor: COLORS.slate700, backgroundColor: COLORS.bgInput,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14,
    color: COLORS.textPrimary,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center', position: 'relative',
  },
  eyeBtn: {
    position: 'absolute', right: 12, padding: 4,
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.violet,
    paddingVertical: 13, marginTop: 20,
  },
  submitText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  linkRow: {
    flexDirection: 'row', justifyContent: 'center', marginTop: 20,
  },
  linkText: { fontSize: 13, color: COLORS.textMuted },
  linkAction: { fontSize: 13, fontWeight: '500', color: COLORS.violetText },
});
