import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { orgsApi } from '../services/apiHandler';
import { QUERY_KEYS, MEMBER_ROLES } from '../utils/constants';
import { formatDate, getInitials, slugify } from '../utils/helpers';
import { COLORS, SPACING, BORDER_RADIUS } from '../utils/theme';
import Loader from '../components/Loader';

function RoleBadge({ role }) {
  const cfg = {
    owner: { icon: 'trophy', color: COLORS.amberText, bg: COLORS.amberDim },
    admin: { icon: 'shield-checkmark', color: COLORS.blueText, bg: COLORS.blueDim },
    member: { icon: 'person', color: COLORS.textSecondary, bg: 'rgba(100,116,139,0.15)' },
  };
  const c = cfg[role] || cfg.member;
  return (
    <View style={[s.roleBadge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon} size={10} color={c.color} />
      <Text style={[s.roleText, { color: c.color }]}>{role}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, activeOrg, setActiveOrg, userRole, isOwnerOrAdmin, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });
  const [memberForm, setMemberForm] = useState({ email: '', role: 'member' });
  const [orgError, setOrgError] = useState('');
  const [memberError, setMemberError] = useState('');

  const { data: orgs = [], isLoading: orgsLoading } = useFetch(QUERY_KEYS.ORGS, () => orgsApi.listMyOrgs());
  const { data: members = [], isLoading: membersLoading } = useFetch(
    QUERY_KEYS.ORG_MEMBERS(activeOrg?.id), () => orgsApi.listMembers(activeOrg?.id), { enabled: !!activeOrg?.id });

  const createOrgMut = useMutation({
    mutationFn: (data) => orgsApi.createOrg(data),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORGS }); setActiveOrg(data); setShowNewOrg(false); setOrgForm({ name:'', slug:'' }); },
    onError: (err) => setOrgError(err.response?.data?.detail || 'Failed.'),
  });
  const addMemberMut = useMutation({
    mutationFn: (data) => orgsApi.addMember(activeOrg?.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORG_MEMBERS(activeOrg?.id) }); setShowAddMember(false); setMemberForm({ email:'', role:'member' }); },
    onError: (err) => setMemberError(err.response?.data?.detail || 'Failed.'),
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 40 }}>
      <Text style={s.pageTitle}>Settings</Text>
      <Text style={s.pageSub}>Manage your profile, organizations, and team.</Text>

      {/* Profile */}
      <View style={s.card}>
        <View style={s.cardHeader}><Ionicons name="person" size={16} color={COLORS.violetText}/><Text style={s.cardTitle}>Profile</Text></View>
        <View style={s.profileRow}>
          <View style={s.avatarFallback}><Text style={s.avatarText}>{getInitials(user?.name||user?.email||'?')}</Text></View>
          <View style={{ flex:1 }}>
            <Text style={s.profileName}>{user?.name||'—'}</Text>
            <Text style={s.profileEmail}>{user?.email}</Text>
            <Text style={s.profileDate}>Since {formatDate(user?.created_at)}</Text>
          </View>
          {userRole && <RoleBadge role={userRole}/>}
        </View>
      </View>

      {/* Orgs */}
      <View style={s.sectionHeader}>
        <Ionicons name="business" size={16} color={COLORS.violetText}/>
        <Text style={s.cardTitle}>Organizations</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => { setOrgError(''); setShowNewOrg(true); }}>
          <Ionicons name="add" size={14} color={COLORS.textSecondary}/><Text style={s.newBtnText}>New Org</Text>
        </TouchableOpacity>
      </View>
      {orgsLoading ? <Loader/> : orgs.map(org => (
        <TouchableOpacity key={org.id} style={[s.orgRow, activeOrg?.id===org.id && s.orgRowActive]} onPress={() => setActiveOrg(org)}>
          <View style={s.orgIcon}><Text style={s.orgIconText}>{org.name.slice(0,2).toUpperCase()}</Text></View>
          <View style={{ flex:1 }}><Text style={s.orgName}>{org.name}</Text><Text style={s.orgSlug}>/{org.slug}</Text></View>
          {activeOrg?.id===org.id && <Text style={s.activeTag}>Active</Text>}
        </TouchableOpacity>
      ))}

      {/* Members */}
      {activeOrg && (
        <>
          <View style={[s.sectionHeader, { marginTop: 20 }]}>
            <Ionicons name="people" size={16} color={COLORS.violetText}/>
            <Text style={s.cardTitle}>Team — {activeOrg.name}</Text>
            {isOwnerOrAdmin && (
              <TouchableOpacity style={s.newBtn} onPress={() => { setMemberError(''); setShowAddMember(true); }}>
                <Ionicons name="add" size={14} color={COLORS.textSecondary}/><Text style={s.newBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
          {membersLoading ? <Loader/> : members.map(m => (
            <View key={m.id} style={s.memberRow}>
              <View style={s.memberAvatar}><Text style={s.memberAvatarText}>{getInitials(m.user_name||m.user_email||'?')}</Text></View>
              <View style={{ flex:1 }}><Text style={s.memberName}>{m.user_name||'Unknown'}</Text><Text style={s.memberEmail}>{m.user_email||''}</Text></View>
              <RoleBadge role={m.role}/>
            </View>
          ))}
        </>
      )}

      {/* Logout */}
      <TouchableOpacity style={s.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.redText}/>
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>

      {/* New Org Modal */}
      <Modal visible={showNewOrg} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHead}><Text style={s.modalTitle}>Create Organization</Text><TouchableOpacity onPress={() => setShowNewOrg(false)}><Ionicons name="close" size={20} color={COLORS.textMuted}/></TouchableOpacity></View>
            {orgError ? <View style={s.errBox}><Text style={s.errText}>{orgError}</Text></View> : null}
            <Text style={s.label}>Name</Text>
            <TextInput style={s.input} placeholder="Acme Corp" placeholderTextColor={COLORS.textMuted} value={orgForm.name} onChangeText={v => setOrgForm(f => ({...f, name:v, slug:slugify(v)}))}/>
            <Text style={[s.label,{marginTop:12}]}>Slug</Text>
            <TextInput style={s.input} placeholder="acme-corp" placeholderTextColor={COLORS.textMuted} value={orgForm.slug} onChangeText={v => setOrgForm(f => ({...f, slug:v}))} autoCapitalize="none"/>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowNewOrg(false)}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.createBtn} onPress={() => { setOrgError(''); if(!orgForm.name||!orgForm.slug){setOrgError('Required.');return;} createOrgMut.mutate(orgForm); }} disabled={createOrgMut.isPending}>
                {createOrgMut.isPending && <ActivityIndicator size="small" color="#fff" style={{marginRight:6}}/>}
                <Text style={s.createText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Member Modal */}
      <Modal visible={showAddMember} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHead}><Text style={s.modalTitle}>Add Member</Text><TouchableOpacity onPress={() => setShowAddMember(false)}><Ionicons name="close" size={20} color={COLORS.textMuted}/></TouchableOpacity></View>
            {memberError ? <View style={s.errBox}><Text style={s.errText}>{memberError}</Text></View> : null}
            <Text style={s.label}>Email</Text>
            <TextInput style={s.input} placeholder="member@example.com" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" value={memberForm.email} onChangeText={v => setMemberForm(f => ({...f, email:v}))}/>
            <Text style={[s.label,{marginTop:12}]}>Role</Text>
            <View style={s.roleRow}>
              {['admin','member'].map(r => (
                <TouchableOpacity key={r} style={[s.rolePick, memberForm.role===r && s.rolePickActive]} onPress={() => setMemberForm(f => ({...f, role:r}))}>
                  <Text style={[s.rolePickText, memberForm.role===r && {color:COLORS.violetText}]}>{r.charAt(0).toUpperCase()+r.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAddMember(false)}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={s.createBtn} onPress={() => { setMemberError(''); if(!memberForm.email){setMemberError('Email required.');return;} addMemberMut.mutate(memberForm); }} disabled={addMemberMut.isPending}>
                {addMemberMut.isPending && <ActivityIndicator size="small" color="#fff" style={{marginRight:6}}/>}
                <Text style={s.createText}>Invite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor: COLORS.bg },
  pageTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
  pageSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, marginBottom: 20 },
  card: { borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: 'rgba(30,41,59,0.6)', backgroundColor: 'rgba(15,23,42,0.4)', padding: 16, marginBottom: 20 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarFallback: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.violetText },
  profileName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  profileEmail: { fontSize: 13, color: COLORS.textSecondary },
  profileDate: { fontSize: 11, color: COLORS.textDim, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', borderRadius: 8, borderWidth: 1, borderColor: COLORS.slate700, paddingHorizontal: 10, paddingVertical: 5 },
  newBtnText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: 'rgba(30,41,59,0.6)', backgroundColor: 'rgba(15,23,42,0.4)', padding: 14, marginBottom: 8 },
  orgRowActive: { borderColor: COLORS.violetBorder, backgroundColor: COLORS.violetDim },
  orgIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(124,58,237,0.2)', alignItems: 'center', justifyContent: 'center' },
  orgIconText: { fontSize: 11, fontWeight: '700', color: COLORS.violetText },
  orgName: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  orgSlug: { fontSize: 11, color: COLORS.textMuted },
  activeTag: { fontSize: 11, color: COLORS.violetText, fontWeight: '500' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: 'rgba(30,41,59,0.6)', backgroundColor: 'rgba(15,23,42,0.4)', padding: 14, marginBottom: 8 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.slate800, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.slate700 },
  memberAvatarText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  memberName: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  memberEmail: { fontSize: 11, color: COLORS.textMuted },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.redBorder, backgroundColor: COLORS.redDim, paddingVertical: 14 },
  logoutText: { fontSize: 14, fontWeight: '600', color: COLORS.redText },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: 20 },
  modalCard: { backgroundColor: COLORS.slate900, borderRadius: BORDER_RADIUS.xl, borderWidth: 1, borderColor: 'rgba(51,65,85,0.6)', padding: 24 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  label: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginBottom: 6 },
  input: { borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.slate700, backgroundColor: COLORS.bgInput, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: COLORS.textPrimary },
  roleRow: { flexDirection: 'row', gap: 8 },
  rolePick: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  rolePickActive: { borderColor: COLORS.violetBorder, backgroundColor: COLORS.violetDim },
  rolePickText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  errBox: { borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, marginBottom: 12 },
  errText: { fontSize: 13, color: COLORS.redText },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.slate700, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: COLORS.textSecondary, fontSize: 14 },
  createBtn: { flex: 1, flexDirection: 'row', borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.violet, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  createText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
