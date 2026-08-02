import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/apiHandler';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, SPACING, BORDER_RADIUS } from '../../utils/theme';

export default function SignupScreen({ navigation }) {
  const { login, loginWithToken } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [formError, setFormError] = useState('');

  const signupMutation = useMutation({
    mutationFn: (data) => authApi.signup(data),
    onSuccess: (data) => {
      login(data.access_token, data.user);
    },
    onError: (err) => {
      console.error('[Signup Error]', err.message, err.response?.status, err.response?.data);
      if (!err.response) {
        setFormError(`Network error: ${err.message}. Check if backend is reachable.`);
        return;
      }
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail.map((d) => d.msg).join(', '));
      } else {
        setFormError(detail || `Registration failed (${err.response.status}).`);
      }
    },
  });

  const googleMutation = useMutation({
    mutationFn: () => authApi.getGoogleUrl(),
    onSuccess: async (data) => {
      const result = await WebBrowser.openAuthSessionAsync(data.url, 'tracelify://auth/callback');
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const token = url.searchParams.get('token');
        if (token) await loginWithToken(token);
      }
    },
    onError: () => setFormError('Failed to initiate Google login.'),
  });

  const handleSubmit = () => {
    setFormError('');
    if (!form.name || !form.email || !form.password) {
      setFormError('Please fill in all fields.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    signupMutation.mutate(form);
  };

  return (
    <View style={styles.container}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Ionicons name="flash" size={24} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>Tracelify</Text>
            <Text style={styles.brandSub}>Production error tracking</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Create an account</Text>
            <Text style={styles.subHeading}>Start tracking errors in minutes</Text>

            <TouchableOpacity style={styles.googleBtn} onPress={() => googleMutation.mutate()} disabled={googleMutation.isPending} activeOpacity={0.7}>
              {googleMutation.isPending ? (
                <ActivityIndicator size="small" color={COLORS.textPrimary} />
              ) : (
                <Ionicons name="logo-google" size={18} color={COLORS.textPrimary} />
              )}
              <Text style={styles.googleText}>Sign up with Google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or with email</Text>
              <View style={styles.dividerLine} />
            </View>

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Jane Smith"
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              value={form.email}
              onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Password (min 8 characters)</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, { flex: 1, paddingRight: 44 }]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPwd}
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPwd((v) => !v)}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={signupMutation.isPending} activeOpacity={0.7}>
              {signupMutation.isPending && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
              <Text style={styles.submitText}>Create account</Text>
            </TouchableOpacity>

            <View style={styles.linkRow}>
              <Text style={styles.linkText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkAction}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  blobTop: { position: 'absolute', top: -120, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(124,58,237,0.08)' },
  blobBottom: { position: 'absolute', bottom: -120, right: -120, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(59,130,246,0.08)' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  brand: { alignItems: 'center', marginBottom: 28 },
  logoWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.violet, alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.violet, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  brandTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary, marginTop: 10 },
  brandSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  card: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: 'rgba(30,41,59,0.6)', backgroundColor: 'rgba(15,23,42,0.6)', padding: 24 },
  heading: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  subHeading: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, marginBottom: 20 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.slate700, backgroundColor: 'rgba(30,41,59,0.6)', paddingVertical: 12, marginBottom: 16 },
  googleText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.slate800 },
  dividerText: { fontSize: 11, color: COLORS.textDim },
  errorBox: { borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13, color: COLORS.redText },
  label: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.slate700, backgroundColor: COLORS.bgInput, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  eyeBtn: { position: 'absolute', right: 12, padding: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.violet, paddingVertical: 13, marginTop: 20 },
  submitText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  linkText: { fontSize: 13, color: COLORS.textMuted },
  linkAction: { fontSize: 13, fontWeight: '500', color: COLORS.violetText },
});
