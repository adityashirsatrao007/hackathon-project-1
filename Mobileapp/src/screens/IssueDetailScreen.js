import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi } from '../services/apiHandler';
import { useFetch } from '../hooks/useFetch';
import { QUERY_KEYS } from '../utils/constants';
import { formatDate, formatRelativeTime, copyToClipboard } from '../utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';
import Loader from '../components/Loader';
import StatusBadge from '../components/StatusBadge';

function EventCard({ event, index, isLatest }) {
  const [open, setOpen] = useState(isLatest);
  return (
    <View style={[s.eventCard, isLatest && s.eventCardLatest]}>
      <TouchableOpacity style={s.eventHeader} onPress={() => setOpen(v => !v)}>
        <View style={[s.eventIdx, isLatest && { backgroundColor: 'rgba(124,58,237,0.3)' }]}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: isLatest ? COLORS.violetText : COLORS.textMuted }}>{index + 1}</Text>
        </View>
        <View style={s.envTag}><Text style={s.envText}>{event.environment}</Text></View>
        <Text style={s.evTime}>{formatRelativeTime(event.received_at)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textDim} />
      </TouchableOpacity>
      {open && (
        <View style={s.eventBody}>
          {event.message && (
            <View style={s.errBox}>
              <Text style={s.errLabel}>Error Message</Text>
              <Text style={s.errVal}>{event.message}</Text>
            </View>
          )}
          {event.stacktrace && (
            <View style={s.stackBox}>
              <ScrollView horizontal><Text style={s.stackText}>{event.stacktrace}</Text></ScrollView>
            </View>
          )}
          {event.tags && Object.keys(event.tags).length > 0 && (
            <View style={s.tagsRow}>
              {Object.entries(event.tags).map(([k, v]) => (
                <View key={k} style={s.tagPill}>
                  <Text style={s.tagKey}>{k}: </Text><Text style={s.tagVal}>{String(v)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function IssueDetailScreen() {
  const route = useRoute();
  const { projectId, issueId } = route.params;
  const queryClient = useQueryClient();
  const { data: issue, isLoading } = useFetch(QUERY_KEYS.ISSUE(projectId, issueId), () => issuesApi.getIssue(projectId, issueId), { enabled: !!projectId && !!issueId });
  const { data: events = [], isLoading: evLoad } = useFetch(QUERY_KEYS.ISSUE_EVENTS(projectId, issueId), () => issuesApi.listIssueEvents(projectId, issueId), { enabled: !!projectId && !!issueId });
  const updateMut = useMutation({ mutationFn: (status) => issuesApi.updateIssue(projectId, issueId, { status }), onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ISSUE(projectId, issueId) }); queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'issues'] }); }});

  if (isLoading) return <Loader fullPage />;
  if (!issue) return null;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
      <View style={[s.hero, { borderTopColor: issue.level === 'error' ? COLORS.redText : issue.level === 'warning' ? COLORS.amberText : COLORS.blueText }]}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          <StatusBadge level={issue.level} /><StatusBadge status={issue.status} />
        </View>
        <Text style={s.heroTitle}>{issue.title}</Text>
        <View style={s.statusBtns}>
          {['open','resolved','ignored'].map(st => (
            <TouchableOpacity key={st} style={[s.stBtn, issue.status === st && s.stBtnActive]} onPress={() => updateMut.mutate(st)}>
              <Text style={[s.stBtnText, issue.status === st && { color: COLORS.violetText }]}>{st.charAt(0).toUpperCase()+st.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={s.statsRow}>
        {[{ l: 'Events', v: issue.event_count, c: COLORS.violetText },{ l: 'Users', v: issue.user_count, c: COLORS.amberText },{ l: 'First', v: formatDate(issue.first_seen), c: COLORS.textSecondary },{ l: 'Last', v: formatRelativeTime(issue.last_seen), c: COLORS.redText }].map(x => (
          <View key={x.l} style={s.stat}><Text style={[s.statV, { color: x.c }]}>{typeof x.v === 'number' ? x.v.toLocaleString() : x.v}</Text><Text style={s.statL}>{x.l}</Text></View>
        ))}
      </View>
      <View style={s.section}><View style={s.secHead}><Ionicons name="finger-print" size={14} color={COLORS.violetText}/><Text style={s.secTitle}>Fingerprint</Text></View><View style={s.secBody}><Text style={s.fpText}>{issue.fingerprint}</Text></View></View>
      <View style={s.section}><View style={s.secHead}><Ionicons name="layers" size={14} color={COLORS.violetText}/><Text style={s.secTitle}>Events ({events.length})</Text></View><View style={s.secBody}>
        {evLoad ? <Loader /> : events.map((ev, i) => <EventCard key={ev.id} event={ev} index={i} isLatest={i===0}/>)}
      </View></View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3, padding: 16, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.015)' },
  heroTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  statusBtns: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  stBtnActive: { borderColor: COLORS.violetBorder, backgroundColor: COLORS.violetDim },
  stBtnText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, padding: 10, alignItems: 'center' },
  statV: { fontSize: 14, fontWeight: '700' },
  statL: { fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase', marginTop: 2 },
  section: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.015)' },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  secTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  secBody: { padding: 14 },
  fpText: { fontSize: 11, color: COLORS.violetText, fontFamily: 'monospace' },
  eventCard: { borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 10, overflow: 'hidden' },
  eventCardLatest: { borderColor: 'rgba(124,58,237,0.25)', backgroundColor: 'rgba(124,58,237,0.05)' },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  eventIdx: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  envTag: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  envText: { fontSize: 10, color: COLORS.textMuted },
  evTime: { fontSize: 10, color: COLORS.textMuted, marginLeft: 'auto' },
  eventBody: { padding: 12, gap: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  errBox: { backgroundColor: 'rgba(127,29,29,0.2)', borderRadius: 8, padding: 12 },
  errLabel: { fontSize: 10, color: 'rgba(239,68,68,0.6)', textTransform: 'uppercase', marginBottom: 4 },
  errVal: { fontSize: 13, fontWeight: '600', color: '#fca5a5' },
  stackBox: { borderRadius: 8, backgroundColor: 'rgba(127,29,29,0.15)', overflow: 'hidden' },
  stackText: { fontSize: 11, lineHeight: 18, color: COLORS.textSecondary, fontFamily: 'monospace', padding: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagPill: { flexDirection: 'row', backgroundColor: COLORS.violetDim, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 4 },
  tagKey: { fontSize: 11, color: COLORS.textMuted },
  tagVal: { fontSize: 11, color: COLORS.violetText },
});
