import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, ActivityIndicator, Modal, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi } from '../services/apiHandler';
import { useFetch } from '../hooks/useFetch';
import { useAuth } from '../hooks/useAuth';
import { QUERY_KEYS, PLATFORMS } from '../utils/constants';
import { formatRelativeTime, slugify } from '../utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const PLATFORM_EMOJI = {
  python: '🐍', javascript: '🟨', react: '⚛️', node: '🟢',
  django: '🎸', fastapi: '⚡', flask: '🧪', java: '☕',
  cpp: '⚙️', go: '🐹', ruby: '💎', php: '🐘', other: '📦',
};

export default function ProjectsScreen({ navigation }) {
  const route = useRoute();
  const orgId = route.params?.orgId;
  const queryClient = useQueryClient();
  const { isOwnerOrAdmin } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', platform: 'python' });
  const [formError, setFormError] = useState('');
  const [platformPickerOpen, setPlatformPickerOpen] = useState(false);

  const { data: projects = [], isLoading } = useFetch(
    QUERY_KEYS.PROJECTS(orgId),
    () => projectsApi.listProjects(orgId),
    { enabled: !!orgId },
  );

  const createMutation = useMutation({
    mutationFn: (data) => projectsApi.createProject(orgId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS(orgId) });
      setShowCreate(false);
      setForm({ name: '', slug: '', platform: 'python' });
      navigation.navigate('ProjectDetail', { orgId, projectId: data.project.id });
    },
    onError: (err) => setFormError(err.response?.data?.detail || 'Failed to create project.'),
  });

  const handleCreate = () => {
    setFormError('');
    if (!form.name || !form.slug) { setFormError('Name and slug are required.'); return; }
    createMutation.mutate(form);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.subtitle}>Manage your projects and error tracking</Text>
        </View>
        {isOwnerOrAdmin && (
          <TouchableOpacity style={styles.newBtn} onPress={() => { setFormError(''); setShowCreate(true); }}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? <Loader /> : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to start capturing errors.">
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.newBtnText}>Create project</Text>
          </TouchableOpacity>
        </EmptyState>
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingTop: 0 }}>
          {projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={styles.card}
              onPress={() => navigation.navigate('ProjectDetail', { orgId, projectId: project.id })}
              activeOpacity={0.7}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardIcon}>
                  <Text style={{ fontSize: 22 }}>{PLATFORM_EMOJI[project.platform] ?? '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{project.name}</Text>
                  <Text style={styles.cardSlug}>{project.slug}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textDimmer} />
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.platformTag}>
                  <Text style={styles.platformTagText}>{project.platform}</Text>
                </View>
                <Text style={styles.cardDate}>{formatRelativeTime(project.created_at)}</Text>
              </View>
              {/* Action buttons */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.issuesBtn}
                  onPress={() => navigation.navigate('Issues', { orgId, projectId: project.id })}
                >
                  <Ionicons name="alert-circle" size={16} color={COLORS.redText} />
                  <Text style={styles.issuesBtnText}>View Issues</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Project</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {formError ? <View style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View> : null}

            <Text style={styles.label}>Project name</Text>
            <TextInput
              style={styles.input}
              placeholder="My Backend Service"
              placeholderTextColor={COLORS.textMuted}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v, slug: slugify(v) }))}
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Slug</Text>
            <TextInput
              style={[styles.input, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}
              placeholder="my-backend-service"
              placeholderTextColor={COLORS.textMuted}
              value={form.slug}
              onChangeText={(v) => setForm((f) => ({ ...f, slug: v }))}
              autoCapitalize="none"
            />

            <Text style={[styles.label, { marginTop: 12 }]}>Platform</Text>
            <TouchableOpacity style={styles.input} onPress={() => setPlatformPickerOpen(!platformPickerOpen)}>
              <Text style={{ color: COLORS.textPrimary, fontSize: 14 }}>
                {PLATFORMS.find((p) => p.value === form.platform)?.label || form.platform}
              </Text>
            </TouchableOpacity>
            {platformPickerOpen && (
              <ScrollView style={styles.picker} nestedScrollEnabled>
                {PLATFORMS.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.pickerItem, form.platform === p.value && styles.pickerItemActive]}
                    onPress={() => { setForm((f) => ({ ...f, platform: p.value })); setPlatformPickerOpen(false); }}
                  >
                    <Text style={{ color: form.platform === p.value ? COLORS.violetText : COLORS.textSecondary, fontSize: 13 }}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />}
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.violet, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BORDER_RADIUS.md },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.02)', marginBottom: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  cardIcon: { width: 44, height: 44, borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.violetDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.1)' },
  cardName: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  cardSlug: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  platformTag: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  platformTagText: { fontSize: 11, color: COLORS.textSecondary },
  cardDate: { fontSize: 11, color: COLORS.textDim, marginLeft: 'auto' },
  cardActions: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', padding: 10 },
  issuesBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.redDim, borderWidth: 1, borderColor: COLORS.redBorder, borderRadius: BORDER_RADIUS.lg, paddingVertical: 10 },
  issuesBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.redText },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: COLORS.slate900, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: 'rgba(51,65,85,0.6)', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  label: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.slate700, backgroundColor: COLORS.bgInput, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary },
  picker: { maxHeight: 180, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgElevated, marginTop: 4 },
  pickerItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pickerItemActive: { backgroundColor: COLORS.violetDim },
  errorBox: { borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, marginBottom: 12 },
  errorText: { fontSize: 13, color: COLORS.redText },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.slate700, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 14 },
  createBtn: { flex: 1, flexDirection: 'row', borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.violet, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
