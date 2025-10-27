'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/lib/auth/auth-client';
import { ArrowLeft } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Group name must be at least 2 characters.',
  }).max(50, {
    message: 'Group name must be less than 50 characters.',
  }),
  description: z.string().max(200, {
    message: 'Description must be less than 200 characters.',
  }).optional(),
  members: z.string().optional(),
});

export default function CreateGroupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      members: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setCreating(true);
    setError(null);

    try {
      // Get user email from session
      const userEmail = session?.user?.email;
      const userName = session?.user?.name;

      if (!userEmail) {
        setError('You must be signed in to create a group');
        setCreating(false);
        return;
      }

      // 1. Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: values.name.trim(),
          description: values.description?.trim() || null,
          created_by: userEmail,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // 2. Add creator as owner
      const { error: ownerError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_email: userEmail,
          user_name: userName || userEmail.split('@')[0],
          role: 'owner',
        });

      if (ownerError) throw ownerError;

      // 3. Add additional members (if any)
      if (values.members?.trim()) {
        const memberEmails = values.members
          .split(',')
          .map(email => email.trim().toLowerCase()) // Normalize to lowercase
          .filter(email => email && email !== userEmail?.toLowerCase());

        if (memberEmails.length > 0) {
          const memberInserts = memberEmails.map(email => ({
            group_id: groupData.id,
            user_email: email,
            user_name: email.split('@')[0], // Use email prefix as default name
            role: 'member',
          }));

          const { error: membersError } = await supabase
            .from('group_members')
            .insert(memberInserts);

          if (membersError) {
            console.error('Error adding members:', membersError);
            setError(`Group created, but failed to add some members: ${membersError.message}`);
            setCreating(false);
            return;
          }
        }
      }

      // Redirect to the group page
      router.push(`/groups/${groupData.id}`);
    } catch (err) {
      console.error('Error creating group:', err);
      setError('Failed to create group. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
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
          <h1 className="text-3xl font-bold">Create New Group</h1>
          <p className="text-muted-foreground mt-1">
            Set up a persistent group for recurring Beat Battle sessions
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Group Details</CardTitle>
            <CardDescription>
              Create a group to organize sessions with the same people
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-6">
                {error}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Friday Night Crew" {...field} />
                      </FormControl>
                      <FormDescription>
                        Choose a memorable name for your group
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., Weekly Beat Battle sessions every Friday night"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Briefly describe the purpose of this group
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="members"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invite Members (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="email1@example.com, email2@example.com"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter email addresses separated by commas. You can also add members later.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={creating}
                    className="flex-1"
                  >
                    {creating ? 'Creating...' : 'Create Group'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/groups')}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
