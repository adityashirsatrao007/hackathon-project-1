import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { orgsApi, projectsApi, issuesApi } from '../services/apiHandler';
import { QUERY_KEYS } from '../utils/constants';
import { formatRelativeTime, formatCount, getInitials } from '../utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

function StatCard({ label, value, icon, iconColor, bgColor, borderColor, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: bgColor, borderColor }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.statIcon, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.statValue, { color: iconColor }]}>
        {value === null ? '…' : formatCount(value)}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function IssueRow({ issue, onPress }) {
  const levelColors = { error: COLORS.redText, warning: COLORS.amberText, info: COLORS.blueText };
  return (
    <TouchableOpacity style={styles.issueRow} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name="alert-circle" size={16} color={levelColors[issue.level] || COLORS.textMuted} />
      <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
      <Text style={styles.issueTime}>{formatRelativeTime(issue.last_seen)}</Text>
    </TouchableOpacity>
  );
}

function ProjectRow({ project, orgId, navigation }) {
  return (
    <TouchableOpacity
      style={styles.projectRow}
      onPress={() => navigation.navigate('ProjectDetail', { orgId, projectId: project.id })}
      activeOpacity={0.7}
    >
      <View style={styles.projectIcon}>
        <Ionicons name="folder" size={16} color={COLORS.violetText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
        <Text style={styles.projectPlatform}>{project.platform}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textDimmer} />
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user, activeOrg, setActiveOrg, userRole } = useAuth();

  const { data: orgs = [], isLoading: orgsLoading } = useFetch(
    QUERY_KEYS.ORGS,
    () => orgsApi.listMyOrgs(),
  );

  if (!activeOrg && orgs.length > 0 && !orgsLoading) setActiveOrg(orgs[0]);
  const displayOrg = activeOrg || orgs[0];

  const { data: projects = [], isLoading: projectsLoading } = useFetch(
    QUERY_KEYS.PROJECTS(displayOrg?.id),
    () => projectsApi.listProjects(displayOrg?.id),
    { enabled: !!displayOrg?.id },
  );

  const firstProject = projects[0];

  const { data: recentIssuesData } = useFetch(
    [...QUERY_KEYS.ISSUES(firstProject?.id, { status: 'open', limit: 5 }), 'recent'],
    () => issuesApi.listIssues(firstProject.id, { status: 'open', limit: 5 }),
    { enabled: !!firstProject },
  );

  const { data: resolvedData } = useFetch(
    QUERY_KEYS.ISSUES(firstProject?.id, { status: 'resolved', limit: 1 }),
    () => issuesApi.listIssues(firstProject.id, { status: 'resolved', limit: 1 }),
    { enabled: !!firstProject },
  );

  const openCount = !firstProject ? 0 : (recentIssuesData?.total ?? null);
  const resolvedCount = !firstProject ? 0 : (resolvedData?.total ?? null);
  const recentIssues = recentIssuesData?.issues ?? [];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {greeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
          </Text>
          <Text style={styles.headerSub}>
            {displayOrg ? `Monitoring errors in ${displayOrg.name}` : 'Create an org to get started'}
          </Text>
        </View>
        {user?.picture ? (
          <Image source={{ uri: user.picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>{getInitials(user?.name || user?.email || '?')}</Text>
          </View>
        )}
      </View>

      {/* Org pills */}
      {orgs.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgPills}>
          {orgs.slice(0, 5).map((org) => (
            <TouchableOpacity
              key={org.id}
              style={[styles.orgPill, displayOrg?.id === org.id && styles.orgPillActive]}
              onPress={() => setActiveOrg(org)}
            >
              <View style={styles.orgPillDot}>
                <Text style={styles.orgPillDotText}>{getInitials(org.name).slice(0, 1)}</Text>
              </View>
              <Text style={[styles.orgPillText, displayOrg?.id === org.id && styles.orgPillTextActive]}>
                {org.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {orgsLoading ? (
        <Loader />
      ) : orgs.length === 0 ? (
        <EmptyState
          title="No organizations yet"
          description="Create your first organization to start tracking errors."
          icon="business-outline"
        >
          <TouchableOpacity style={styles.ctaBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.ctaBtnText}>Create organization</Text>
          </TouchableOpacity>
        </EmptyState>
      ) : (
        <>
          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard label="Projects" value={projects.length} icon="layers" iconColor={COLORS.violetText} bgColor={COLORS.violetDim} borderColor={COLORS.violetBorder}
              onPress={() => navigation.navigate('Projects', { orgId: displayOrg?.id })} />
            <StatCard label="Open" value={openCount} icon="alert-circle" iconColor={COLORS.redText} bgColor={COLORS.redDim} borderColor={COLORS.redBorder}
              onPress={firstProject ? () => navigation.navigate('Issues', { orgId: displayOrg?.id, projectId: firstProject.id }) : null} />
            <StatCard label="Resolved" value={resolvedCount} icon="checkmark-circle" iconColor={COLORS.emeraldText} bgColor={COLORS.emeraldDim} borderColor={COLORS.emeraldBorder} />
          </View>

          {/* Recent Issues */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="alert-circle" size={14} color={COLORS.redText} />
              <Text style={styles.sectionTitle}>Recent Issues</Text>
            </View>
            {recentIssues.length === 0 ? (
              <View style={styles.emptySection}>
                <Ionicons name="checkmark-circle" size={28} color="rgba(16,185,129,0.3)" />
                <Text style={styles.emptySectionText}>
                  {firstProject ? 'No open issues 🎉' : 'Create a project first'}
                </Text>
              </View>
            ) : (
              recentIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  onPress={() => navigation.navigate('IssueDetail', {
                    orgId: displayOrg?.id,
                    projectId: firstProject.id,
                    issueId: issue.id,
                  })}
                />
              ))
            )}
          </View>

          {/* Projects */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="folder" size={14} color={COLORS.violetText} />
              <Text style={styles.sectionTitle}>Projects</Text>
              <TouchableOpacity
                style={{ marginLeft: 'auto' }}
                onPress={() => navigation.navigate('Projects', { orgId: displayOrg?.id })}
              >
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            </View>
            {projectsLoading ? (
              <Loader />
            ) : projects.length === 0 ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>No projects yet</Text>
              </View>
            ) : (
              projects.slice(0, 4).map((project) => (
                <ProjectRow key={project.id} project={project} orgId={displayOrg?.id} navigation={navigation} />
              ))
            )}
          </View>

          {/* System Status */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.textMuted} />
              <Text style={styles.sectionTitle}>System Status</Text>
            </View>
            {['API Server', 'Database', 'Event Queue', 'Workers'].map((label) => (
              <View key={label} style={styles.statusRow}>
                <Text style={styles.statusLabel}>{label}</Text>
                <View style={styles.statusRight}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Operational</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  greeting: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border },
  avatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.violetBorder },
  avatarText: { fontSize: 12, fontWeight: '600', color: COLORS.violetText },
  orgPills: { marginBottom: SPACING.lg },
  orgPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.03)', marginRight: 8 },
  orgPillActive: { borderColor: COLORS.violetBorder, backgroundColor: COLORS.violetDim },
  orgPillDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(124,58,237,0.4)', alignItems: 'center', justifyContent: 'center' },
  orgPillDotText: { fontSize: 8, fontWeight: '700', color: COLORS.violetText },
  orgPillText: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted },
  orgPillTextActive: { color: COLORS.violetText },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.lg },
  statCard: { flex: 1, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, padding: 14 },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '500', marginTop: 2 },
  section: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: 'rgba(255,255,255,0.015)', marginBottom: SPACING.lg, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  viewAll: { fontSize: 11, color: COLORS.textMuted },
  issueRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  issueTitle: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  issueTime: { fontSize: 10, color: COLORS.textDim },
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  projectIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.violetDim, alignItems: 'center', justifyContent: 'center' },
  projectName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  projectPlatform: { fontSize: 10, color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: 1, marginTop: 1 },
  emptySection: { alignItems: 'center', paddingVertical: 28 },
  emptySectionText: { fontSize: 12, color: COLORS.textDim, marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  statusLabel: { fontSize: 11, color: COLORS.textMuted },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.emeraldText },
  statusText: { fontSize: 11, fontWeight: '500', color: COLORS.emeraldText },
  ctaBtn: { backgroundColor: COLORS.violet, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.md },
  ctaBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
