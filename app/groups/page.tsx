'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/lib/auth/auth-client';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { ArrowLeft, Calendar, Loader2, Plus, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Group = Database['public']['Tables']['groups']['Row'];

interface GroupWithMembers extends Group {
  member_count: number;
  is_owner: boolean;
}

export default function GroupsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending) {
      loadGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, session]);

  const loadGroups = async () => {
    try {
      // Get user email from Better Auth session
      // Groups feature doesn't require authentication - anyone can create/view
      const email = session?.user?.email;

      if (email) {
        // Load groups where user is a member (normalize email to lowercase)
        const { data: memberData, error: memberError } = await supabase
          .from('group_members')
          .select('group_id, role')
          .eq('user_email', email.toLowerCase());

        if (memberError) throw memberError;

        if (!memberData || memberData.length === 0) {
          setGroups([]);
          setLoading(false);
          return;
        }

        const groupIds = memberData.map(m => m.group_id);

        // Load group details
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false });

        if (groupsError) throw groupsError;

        // Count members for each group
        const groupsWithMembers: GroupWithMembers[] = await Promise.all(
          (groupsData || []).map(async (group) => {
            const { count } = await supabase
              .from('group_members')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', group.id);

            const member = memberData.find(m => m.group_id === group.id);

            return {
              ...group,
              member_count: count || 0,
              is_owner: member?.role === 'owner',
            };
          })
        );

        setGroups(groupsWithMembers);
      } else {
        // No session - show empty state
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = () => {
    router.push('/groups/create');
  };

  const handleGroupClick = (groupId: string) => {
    router.push(`/groups/${groupId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-12 text-muted-foreground" />
          <p>Loading groups...</p>
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
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Groups</h1>
              <p className="text-muted-foreground mt-1">
                Persistent groups for recurring Beat Battle sessions
              </p>
            </div>
            {session?.user && (
              <Button onClick={handleCreateGroup}>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            )}
          </div>
        </div>

        {/* Groups List */}
        {groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              {!session?.user ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">Sign in to use groups</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Groups let you organize recurring Beat Battle sessions with the same people
                  </p>
                  <Button onClick={() => router.push('/')}>
                    Go to Home
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Create a group to organize recurring Beat Battle sessions with the same people
                  </p>
                  <Button onClick={handleCreateGroup}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Group
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleGroupClick(group.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {group.name}
                        {group.is_owner && (
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                            Owner
                          </span>
                        )}
                      </CardTitle>
                      {group.description && (
                        <CardDescription className="mt-2">
                          {group.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{group.member_count} members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Created {group.created_at ? new Date(group.created_at).toLocaleDateString() : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
