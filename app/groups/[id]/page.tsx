'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Plus, Trash2, Crown, Shield, User, Play } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type Group = Database['public']['Tables']['groups']['Row'];
type GroupMember = Database['public']['Tables']['group_members']['Row'];
type GroupSession = Database['public']['Tables']['group_sessions']['Row'];
type Session = Database['public']['Tables']['sessions']['Row'];

interface SessionWithDetails extends GroupSession {
  session: Session;
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    setCurrentUserEmail(email);
    loadGroupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load group details
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Load group members
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Find current user's role
      const email = localStorage.getItem('userEmail');
      const currentMember = membersData?.find(m => m.user_email === email);
      if (currentMember) {
        setCurrentUserRole(currentMember.role);
      }

      // Load group sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('group_sessions')
        .select(`
          *,
          session:sessions(*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;
      setSessions(sessionsData as SessionWithDetails[] || []);
    } catch (err) {
      console.error('Error loading group:', err);
      setError('Failed to load group details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      setError('Please enter an email address');
      return;
    }

    const normalizedEmail = newMemberEmail.trim().toLowerCase();

    // Check if already a member
    if (members.some(m => m.user_email.toLowerCase() === normalizedEmail)) {
      setError('This user is already a member');
      return;
    }

    setAddingMember(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_email: normalizedEmail,
          user_name: normalizedEmail.split('@')[0], // Use email prefix as default
          role: 'member',
        });

      if (insertError) throw insertError;

      setNewMemberEmail('');
      await loadGroupData();
    } catch (err) {
      console.error('Error adding member:', err);
      setError('Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (deleteError) throw deleteError;
      await loadGroupData();
    } catch (err) {
      console.error('Error removing member:', err);
      setError('Failed to remove member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const { error: updateError } = await supabase
        .from('group_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (updateError) throw updateError;
      await loadGroupData();
    } catch (err) {
      console.error('Error changing role:', err);
      setError('Failed to change role');
    }
  };

  const handleCreateSession = () => {
    // Navigate to create session page with group context
    router.push(`/create?groupId=${groupId}`);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const isOwner = currentUserRole === 'owner';

  if (loading) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-muted-foreground">Loading group...</div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Group not found</p>
          <Button onClick={() => router.push('/groups')}>Back to Groups</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/groups')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Groups
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{group.name}</h1>
              {group.description && (
                <p className="text-muted-foreground mt-1">{group.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Created {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'Unknown'}
              </p>
            </div>
            <Button onClick={handleCreateSession}>
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        {/* Active Session Banner */}
        {sessions.length > 0 && sessions[0].session && (sessions[0].session.status === 'playing' || sessions[0].session.status === 'waiting') && (
          <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
                  <Play className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">
                    Live Session: {sessions[0].session.name}
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {sessions[0].session.status === 'playing' ? 'Session in progress' : 'Waiting to start'}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => router.push(`/session/${sessions[0].session.id}`)}
              >
                <Play className="h-5 w-5 mr-2" />
                Join Now
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Members Card */}
          <Card>
            <CardHeader>
              <CardTitle>Members ({members.length})</CardTitle>
              <CardDescription>
                People in this group
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Member Form (if allowed) */}
              {canManageMembers && (
                <div className="flex gap-2 pb-4 border-b">
                  <Input
                    placeholder="email@example.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                  />
                  <Button
                    onClick={handleAddMember}
                    disabled={addingMember || !newMemberEmail.trim()}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getRoleIcon(member.role)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">
                          {member.user_name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {member.user_email}
                        </div>
                      </div>
                    </div>

                    {/* Role Management (if allowed) */}
                    {canManageMembers && member.user_email !== currentUserEmail && (
                      <div className="flex items-center gap-2">
                        {isOwner && member.role !== 'owner' && (
                          <select
                            value={member.role}
                            onChange={(e) => handleChangeRole(member.id, e.target.value)}
                            className="text-xs bg-background border rounded px-2 py-1"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        {member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Sessions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Sessions</CardTitle>
              <CardDescription>
                Latest sessions with this group
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No sessions yet. Start one to get going!
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map((groupSession) => {
                    const session = groupSession.session;
                    const status = (session.status || 'finished') as 'playing' | 'waiting' | 'finished';
                    const isActive = status === 'playing' || status === 'waiting';

                    const statusColors: Record<'playing' | 'waiting' | 'finished', string> = {
                      playing: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                      waiting: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
                      finished: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                    };

                    const statusLabels: Record<'playing' | 'waiting' | 'finished', string> = {
                      playing: 'Live',
                      waiting: 'Waiting',
                      finished: 'Finished',
                    };

                    return (
                      <div
                        key={groupSession.id}
                        className={`p-3 rounded-lg cursor-pointer hover:bg-secondary transition-colors ${
                          isActive ? 'bg-secondary' : 'bg-secondary/50'
                        }`}
                        onClick={() => router.push(`/session/${session.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{session.name}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {session.created_at ? new Date(session.created_at).toLocaleDateString() : 'Unknown'}
                            </div>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded-full ${statusColors[status]}`}>
                            {statusLabels[status]}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
