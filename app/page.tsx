'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UserMenu from "@/components/auth/user-menu";
import { Users, Plus, Play, LogIn } from "lucide-react";
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/auth/auth-client';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';

type Group = Database['public']['Tables']['groups']['Row'];
type Session = Database['public']['Tables']['sessions']['Row'];

interface GroupWithMembers extends Group {
  member_count: number;
  activeSession?: Session | null;
}

export default function Home() {
  const router = useRouter();
  const { data: session } = useSession();
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      loadUserGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email]);

  const loadUserGroups = async () => {
    const email = session?.user?.email;
    if (!email) return;

    setLoadingGroups(true);
    try {
      // Load groups where user is a member
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_email', email.toLowerCase())
        .limit(3); // Show only top 3 on homepage

      if (!memberData || memberData.length === 0) {
        setGroups([]);
        setLoadingGroups(false);
        return;
      }

      const groupIds = memberData.map(m => m.group_id);

      // Load group details
      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('created_at', { ascending: false });

      // Count members and check for active sessions for each group
      const groupsWithMembers: GroupWithMembers[] = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          // Check for active session (playing or waiting)
          const { data: groupSessions } = await supabase
            .from('group_sessions')
            .select(`
              session_id,
              sessions (*)
            `)
            .eq('group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1);

          let activeSession: Session | null = null;
          if (groupSessions && groupSessions.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sessionData = (groupSessions[0] as any).sessions;
            if (sessionData && (sessionData.status === 'playing' || sessionData.status === 'waiting')) {
              activeSession = sessionData;
            }
          }

          return {
            ...group,
            member_count: count || 0,
            activeSession,
          };
        })
      );

      setGroups(groupsWithMembers);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoadingGroups(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-12">
      {/* Header with User Menu */}
      <div className="absolute top-4 right-4">
        <UserMenu />
      </div>

      <div className="max-w-6xl mx-auto pt-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            BeatBattle
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Create sessions, invite friends, and compete with music! Rate songs, shuffle playlists, and see who has the best taste.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <Link href="/create">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Create Session</h3>
                  <p className="text-sm text-muted-foreground">Start a new Beat Battle</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/join">
            <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <LogIn className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-lg">Join Session</h3>
                  <p className="text-sm text-muted-foreground">Enter with a session code</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Groups Section */}
        {session?.user ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">My Groups</h2>
                <p className="text-sm text-muted-foreground">Quick access to your groups</p>
              </div>
              <Link href="/groups">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>

            {loadingGroups ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading groups...
              </div>
            ) : groups.length > 0 ? (
              <div className="grid md:grid-cols-3 gap-4">
                {groups.map((group) => (
                  <Card
                    key={group.id}
                    className="hover:bg-accent transition-colors cursor-pointer relative"
                    onClick={() => {
                      if (group.activeSession) {
                        router.push(`/session/${group.activeSession.id}`);
                      } else {
                        router.push(`/groups/${group.id}`);
                      }
                    }}
                  >
                    {group.activeSession && (
                      <div className="absolute top-3 right-3">
                        <div className="flex items-center gap-1 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          LIVE
                        </div>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg pr-16">
                        <Users className="h-5 w-5" />
                        {group.name}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {group.activeSession ? (
                          <span className="text-green-600 font-medium">
                            {group.activeSession.status === 'playing' ? 'Session in progress' : 'Session waiting'}
                          </span>
                        ) : (
                          <span>
                            {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    {group.activeSession && (
                      <CardContent className="pt-0">
                        <Button size="sm" className="w-full" onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/session/${group.activeSession!.id}`);
                        }}>
                          <Play className="h-4 w-4 mr-2" />
                          Join Session
                        </Button>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No groups yet</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Create a group to organize recurring sessions with the same people
                  </p>
                  <Link href="/groups/create">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Group
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card className="mb-8">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Groups</h3>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Sign in to create and manage persistent groups
              </p>
            </CardContent>
          </Card>
        )}

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>Get started in 4 easy steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Create or Join</h4>
                <p className="text-sm text-muted-foreground">
                  Start a new session or join with a code
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Add Songs</h4>
                <p className="text-sm text-muted-foreground">
                  Everyone adds their favorite songs
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Listen & Rate</h4>
                <p className="text-sm text-muted-foreground">
                  Rate each song with 1-5 stars
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">4</span>
                </div>
                <h4 className="font-semibold mb-2">See Results</h4>
                <p className="text-sm text-muted-foreground">
                  Winner has the highest rated songs!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
