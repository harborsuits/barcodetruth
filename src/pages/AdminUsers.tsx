import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Users as UsersIcon, TrendingUp, Activity, UserCheck, Edit, Trash2, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';

interface UserData {
  user_id: string;
  email: string;
  created_at: string;
  total_scans: number;
  scans_today: number;
  last_scan: Date | null;
  roles: string[];
  onboarding_complete: boolean;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, created_at, onboarding_complete')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get user emails from auth.users via admin API
      const userIds = profiles?.map(p => p.id) || [];
      
      // Get scans
      const { data: scans } = await supabase
        .from('user_scans')
        .select('user_id, scanned_at')
        .in('user_id', userIds);

      // Get roles
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Get emails via RPC or direct query
      const { data: authData } = await supabase.auth.admin.listUsers();
      const authUsers = authData?.users || [];

      // Combine data
      const users: UserData[] = profiles?.map(profile => {
        const authUser = authUsers.find(u => u.id === profile.id);
        const userScans = scans?.filter(s => s.user_id === profile.id) || [];
        const recentScans = userScans.filter(s => 
          new Date(s.scanned_at) > new Date(Date.now() - 86400000)
        );
        const userRoles = roles?.filter(r => r.user_id === profile.id).map(r => r.role) || [];
        
        return {
          user_id: profile.id,
          email: authUser?.email || 'Unknown',
          created_at: profile.created_at,
          total_scans: userScans.length,
          scans_today: recentScans.length,
          last_scan: userScans.length > 0 
            ? new Date(Math.max(...userScans.map(s => new Date(s.scanned_at).getTime())))
            : null,
          roles: userRoles,
          onboarding_complete: profile.onboarding_complete,
        };
      }) || [];

      return users;
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteUserId(null);
    },
    onError: (error) => {
      toast.error('Failed to delete user: ' + error.message);
    }
  });

  const totalUsers = usersData?.length || 0;
  const activeToday = usersData?.filter(u => u.scans_today > 0).length || 0;
  const totalScans = usersData?.reduce((sum, u) => sum + u.total_scans, 0) || 0;
  const avgScansPerUser = totalUsers > 0 ? Math.round(totalScans / totalUsers) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              title="Back to Admin"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <UsersIcon className="h-8 w-8 text-primary" />
                User Management
              </h1>
              <p className="text-muted-foreground mt-2">
                View and manage all registered users
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-8">
        {/* Stats Overview */}
        <div>
          <h2 className="text-xl font-semibold mb-4">User Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <UsersIcon className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Total Users</span>
                </div>
                <div className="text-3xl font-bold">{totalUsers}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Active Today</span>
                </div>
                <div className="text-3xl font-bold">{activeToday}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-purple-500" />
                  <span className="text-sm text-muted-foreground">Total Scans</span>
                </div>
                <div className="text-3xl font-bold">{totalScans}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-cyan-500" />
                  <span className="text-sm text-muted-foreground">Avg Scans/User</span>
                </div>
                <div className="text-3xl font-bold">{avgScansPerUser}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Users Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4">All Users</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">User ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Roles</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total Scans</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scans Today</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Last Scan</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Joined</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.map(user => (
                    <tr key={user.user_id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-muted-foreground">
                          {user.user_id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.length > 0 ? (
                            user.roles.map(role => (
                              <Badge 
                                key={role} 
                                variant={role === 'admin' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="outline" className="text-xs">user</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="secondary">{user.total_scans}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.scans_today > 0 ? (
                          <Badge variant="default">{user.scans_today}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {user.last_scan 
                          ? new Date(user.last_scan).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                                title="Delete user"
                                onClick={() => setDeleteUserId(user.user_id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete User</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <p className="text-sm text-muted-foreground">
                                  Are you sure you want to delete user <strong>{user.email}</strong>? 
                                  This will permanently delete their account and all associated data.
                                </p>
                                <div className="flex gap-2 justify-end">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => setDeleteUserId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    variant="destructive"
                                    onClick={() => deleteUserMutation.mutate(user.user_id)}
                                    disabled={deleteUserMutation.isPending}
                                  >
                                    {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
