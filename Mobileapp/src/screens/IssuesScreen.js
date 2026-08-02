import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi } from '../services/apiHandler';
import { useFetch } from '../hooks/useFetch';
import { QUERY_KEYS, DEFAULT_PAGE_LIMIT } from '../utils/constants';
import { formatRelativeTime, formatCount } from '../utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

const STATUS_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
  { value: 'all', label: 'All' },
];

const LEVEL_OPTIONS = [
  { value: '', label: 'All levels' },
  { value: 'error', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
];

export default function IssuesScreen({ navigation }) {
  const route = useRoute();
  const { orgId, projectId } = route.params;
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('open');
  const [levelFilter, setLevelFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const params = {
    status: statusFilter,
    ...(levelFilter && { level: levelFilter }),
    limit: DEFAULT_PAGE_LIMIT,
    offset,
  };

  const { data, isLoading } = useFetch(
    QUERY_KEYS.ISSUES(projectId, params),
    () => issuesApi.listIssues(projectId, params),
    { enabled: !!projectId },
  );

  const issues = data?.issues ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / DEFAULT_PAGE_LIMIT);
  const currentPage = Math.floor(offset / DEFAULT_PAGE_LIMIT) + 1;

  const updateMutation = useMutation({
    mutationFn: ({ issueId, status }) => issuesApi.updateIssue(projectId, issueId, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issues'] }),
  });

  const levelColors = { error: COLORS.redText, warning: COLORS.amberText, info: COLORS.blueText };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Issues</Text>
        <Text style={styles.subtitle}>{formatCount(total)} {statusFilter !== 'all' ? statusFilter : ''} issues</Text>
      </View>

      {/* Status tabs */}
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.value}
              style={[styles.tab, statusFilter === tab.value && styles.tabActive]}
              onPress={() => { setStatusFilter(tab.value); setOffset(0); }}
            >
              <Text style={[styles.tabText, statusFilter === tab.value && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {/* Level filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabs, { marginTop: 8 }]}>
          {LEVEL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.levelPill, levelFilter === opt.value && styles.levelPillActive]}
              onPress={() => { setLevelFilter(opt.value); setOffset(0); }}
            >
              <Text style={[styles.levelPillText, levelFilter === opt.value && styles.levelPillTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? <Loader /> : issues.length === 0 ? (
        <EmptyState title="No issues found" description="No issues match the current filters." icon="checkmark-circle-outline" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {issues.map((issue) => (
            <TouchableOpacity
              key={issue.id}
              style={styles.issueRow}
              onPress={() => navigation.navigate('IssueDetail', { orgId, projectId, issueId: issue.id })}
              activeOpacity={0.7}
            >
              <Ionicons name="alert-circle" size={18} color={levelColors[issue.level] || COLORS.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
                <Text style={styles.issueFP}>{issue.fingerprint?.slice(0, 16)}…</Text>
              </View>
              <View style={styles.issueRight}>
                <StatusBadge level={issue.level} />
                <Text style={styles.issueCount}>{formatCount(issue.event_count)}</Text>
                <Text style={styles.issueTime}>{formatRelativeTime(issue.last_seen)}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <View style={styles.pagination}>
              <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
              <View style={styles.pageButtons}>
                <TouchableOpacity
                  style={[styles.pageBtn, offset === 0 && styles.pageBtnDisabled]}
                  onPress={() => setOffset(Math.max(0, offset - DEFAULT_PAGE_LIMIT))}
                  disabled={offset === 0}
                >
                  <Ionicons name="chevron-back" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.pageBtnText}>Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
                  onPress={() => setOffset(offset + DEFAULT_PAGE_LIMIT)}
                  disabled={currentPage >= totalPages}
                >
                  <Text style={styles.pageBtnText}>Next</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: SPACING.lg, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  tabsWrap: { paddingHorizontal: SPACING.lg, paddingBottom: 12 },
  tabs: { flexDirection: 'row', gap: 4, borderRadius: BORDER_RADIUS.lg, backgroundColor: 'rgba(15,23,42,0.4)', padding: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.violet },
  tabText: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },
  levelPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginRight: 6 },
  levelPillActive: { backgroundColor: COLORS.violetDim, borderColor: COLORS.violetBorder },
  levelPillText: { fontSize: 11, color: COLORS.textMuted },
  levelPillTextActive: { color: COLORS.violetText },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  issueTitle: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  issueFP: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  issueRight: { alignItems: 'flex-end', gap: 4 },
  issueCount: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  issueTime: { fontSize: 10, color: COLORS.textDim },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },
  pageInfo: { fontSize: 11, color: COLORS.textMuted },
  pageButtons: { flexDirection: 'row', gap: 8 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.slate700 },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 11, color: COLORS.textSecondary },
});
