import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users as UsersIcon, TrendingUp, Activity, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminUsers() {
  const navigate = useNavigate();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get scan counts for each user
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: scans, error: scansError } = await supabase
        .from('user_scans')
        .select('user_id, scanned_at')
        .in('user_id', userIds);

      if (scansError) throw scansError;

      // Combine data
      const users = profiles?.map(profile => {
        const userScans = scans?.filter(s => s.user_id === profile.user_id) || [];
        const recentScans = userScans.filter(s => 
          new Date(s.scanned_at) > new Date(Date.now() - 86400000)
        );
        
        return {
          ...profile,
          total_scans: userScans.length,
          scans_today: recentScans.length,
          last_scan: userScans.length > 0 
            ? new Date(Math.max(...userScans.map(s => new Date(s.scanned_at).getTime())))
            : null,
        };
      }) || [];

      return users;
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
                    <th className="px-4 py-3 text-left text-sm font-semibold">User ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Age</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Preferences</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Total Scans</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Last Scan</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.map(user => (
                    <tr key={user.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-muted-foreground">
                          {user.user_id.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.age_range || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {user.location || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {user.pref_labor && (
                            <Badge variant="outline" className="text-xs">Labor</Badge>
                          )}
                          {user.pref_environment && (
                            <Badge variant="outline" className="text-xs">Environment</Badge>
                          )}
                          {user.pref_politics && (
                            <Badge variant="outline" className="text-xs">Politics</Badge>
                          )}
                          {user.pref_social && (
                            <Badge variant="outline" className="text-xs">Social</Badge>
                          )}
                          {!user.pref_labor && !user.pref_environment && !user.pref_politics && !user.pref_social && (
                            <span className="text-xs text-muted-foreground">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="secondary">{user.total_scans}</Badge>
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
