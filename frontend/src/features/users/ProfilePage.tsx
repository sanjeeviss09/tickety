import { useAuthStore } from '../../store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Phone, Building, Briefcase, Calendar, Shield } from 'lucide-react';

export function ProfilePage() {
  const { profile } = useAuthStore();

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Basic Info */}
        <Card className="md:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <div className="h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center mb-4 border-4 border-background shadow-sm">
              <User className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{profile.full_name}</h2>
            <p className="text-muted-foreground text-sm mb-4">{profile.employee_id}</p>
            <Badge variant="outline" className="mb-2">
              <Shield className="h-3 w-3 mr-1" />
              {profile.roles?.name || 'No Role Assigned'}
            </Badge>
            <Badge variant={profile.employment_status === 'Active' ? 'default' : 'secondary'}>
              {profile.employment_status}
            </Badge>
          </CardContent>
        </Card>

        {/* Right Column: Detailed Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center">
                  <Mail className="h-4 w-4 mr-2" /> Email Address
                </span>
                <p className="font-medium">{profile.email_address || '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center">
                  <Phone className="h-4 w-4 mr-2" /> Phone Number
                </span>
                <p className="font-medium">{profile.phone_number || '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center">
                  <Building className="h-4 w-4 mr-2" /> Unit
                </span>
                <p className="font-medium">{profile.units?.name || '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" /> Department
                </span>
                <p className="font-medium">{profile.departments?.name || '—'}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground flex items-center">
                  <Calendar className="h-4 w-4 mr-2" /> Date Joined
                </span>
                <p className="font-medium">
                  {profile.date_joined ? new Date(profile.date_joined).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
