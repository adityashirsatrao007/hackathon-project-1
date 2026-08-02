import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, reportApi } from '../services/apiHandler';
import { useFetch } from '../hooks/useFetch';
import { QUERY_KEYS, API_BASE_URL } from '../utils/constants';
import { formatDate, copyToClipboard } from '../utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';
import Loader from '../components/Loader';

export default function ProjectDetailScreen({ navigation }) {
  const route = useRoute();
  const { orgId, projectId } = route.params;
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState(null);

  const backendHost = new URL(API_BASE_URL).host;
  const fixDsn = (dsn) => dsn?.replace('localhost:8000', backendHost);

  const { data: project, isLoading: projectLoading } = useFetch(
    QUERY_KEYS.PROJECT(projectId),
    () => projectsApi.getProject(projectId),
    { enabled: !!projectId },
  );

  const { data: dsnKeys = [], isLoading: dsnLoading } = useFetch(
    QUERY_KEYS.PROJECT_DSN(projectId),
    () => projectsApi.listDsnKeys(projectId),
    { enabled: !!projectId },
  );

  const rotateMutation = useMutation({
    mutationFn: (label) => projectsApi.createDsnKey(projectId, label),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECT_DSN(projectId) }),
  });

  const generateReportMutation = useMutation({
    mutationFn: () => reportApi.generateProjectReport(projectId),
    onSuccess: (data) => {
      Alert.alert('AI Report Generated', data.full_report?.substring(0, 500) + '…' || 'Report generated.');
    },
    onError: (err) => {
      Alert.alert('Report Failed', err.response?.data?.detail || 'Failed to generate report.');
    },
  });

  const handleCopy = async (text, id) => {
    await copyToClipboard(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const deleteMut = useMutation({
    mutationFn: () => projectsApi.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS(orgId) });
      navigation.goBack();
    },
  });

  const handleDelete = () => {
    Alert.alert('Delete Project', 'This will permanently delete all issues and data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate() },
    ]);
  };

  if (projectLoading) return <Loader fullPage />;
  if (!project) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
      {/* Project Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{project.name}</Text>
        <Text style={styles.infoSub}>Platform: {project.platform} · Created {formatDate(project.created_at)}</Text>

        <View style={styles.infoGrid}>
          {[
            { label: 'Project ID', value: project.id },
            { label: 'Slug', value: project.slug },
            { label: 'Platform', value: project.platform },
          ].map((item) => (
            <View key={item.label} style={styles.infoItem}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.redDim, borderColor: COLORS.redBorder }]}
          onPress={() => navigation.navigate('Issues', { orgId, projectId })}>
          <Ionicons name="alert-circle" size={16} color={COLORS.redText} />
          <Text style={[styles.actionBtnText, { color: COLORS.redText }]}>Issues</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.emeraldDim, borderColor: COLORS.emeraldBorder }]}
          onPress={() => generateReportMutation.mutate()} disabled={generateReportMutation.isPending}>
          {generateReportMutation.isPending ? (
            <ActivityIndicator size="small" color={COLORS.emeraldText} />
          ) : (
            <Ionicons name="sparkles" size={16} color={COLORS.emeraldText} />
          )}
          <Text style={[styles.actionBtnText, { color: COLORS.emeraldText }]}>AI Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.redDim, borderColor: COLORS.redBorder }]}
          onPress={handleDelete}>
          <Ionicons name="trash" size={16} color={COLORS.redText} />
        </TouchableOpacity>
      </View>

      {/* DSN Keys */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DSN Keys</Text>
          <TouchableOpacity
            style={styles.newKeyBtn}
            onPress={() => rotateMutation.mutate(`Key ${dsnKeys.length + 1}`)}
            disabled={rotateMutation.isPending}
          >
            {rotateMutation.isPending ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : (
              <Ionicons name="add" size={16} color={COLORS.textSecondary} />
            )}
            <Text style={styles.newKeyText}>New Key</Text>
          </TouchableOpacity>
        </View>

        {dsnLoading ? <Loader /> : dsnKeys.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>No DSN keys found.</Text>
          </View>
        ) : (
          dsnKeys.map((key) => (
            <View key={key.id} style={styles.dsnCard}>
              <View style={styles.dsnHeader}>
                <Ionicons name="key" size={14} color={COLORS.violetText} />
                <Text style={styles.dsnLabel}>{key.label}</Text>
                <View style={[styles.dsnBadge, key.is_active ? styles.dsnActive : styles.dsnInactive]}>
                  <Text style={[styles.dsnBadgeText, { color: key.is_active ? COLORS.emeraldText : COLORS.textMuted }]}>
                    {key.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.dsnRow} onPress={() => handleCopy(fixDsn(key.dsn), key.id)} activeOpacity={0.7}>
                <Text style={styles.dsnValue} numberOfLines={2}>{fixDsn(key.dsn)}</Text>
                <Ionicons
                  name={copiedKey === key.id ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={copiedKey === key.id ? COLORS.emeraldText : COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  infoCard: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: 'rgba(30,41,59,0.6)', backgroundColor: 'rgba(15,23,42,0.4)', padding: 20, marginBottom: 16 },
  infoTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  infoSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 16 },
  infoGrid: { gap: 12 },
  infoItem: {},
  infoLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 2 },
  infoValue: { fontSize: 13, color: COLORS.textPrimary },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, paddingVertical: 12 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  section: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.015)', overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  newKeyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.slate700, paddingHorizontal: 10, paddingVertical: 5 },
  newKeyText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  dsnCard: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dsnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dsnLabel: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  dsnBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  dsnActive: { backgroundColor: COLORS.emeraldDim },
  dsnInactive: { backgroundColor: COLORS.slate800 },
  dsnBadgeText: { fontSize: 10, fontWeight: '600' },
  dsnRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(2,6,23,0.6)', borderWidth: 1, borderColor: 'rgba(30,41,59,0.6)', borderRadius: BORDER_RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12 },
  dsnValue: { flex: 1, fontSize: 11, color: COLORS.textSecondary, fontFamily: 'monospace' },
});
