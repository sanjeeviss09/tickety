import { Outlet, NavLink } from 'react-router-dom';
import { 
  Settings, Building2, Building, Users, Tag, AlertTriangle, 
  Bell, Laptop, BookOpen, Shield, ScrollText, Database, Info,
  ListTodo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  {
    title: 'General Settings',
    href: '/settings/general',
    icon: Settings,
    description: 'Application defaults and preferences',
  },
  {
    title: 'Company Settings',
    href: '/settings/company',
    icon: Building2,
    description: 'Company information and branding',
  },
  {
    title: 'Organization',
    href: '/settings/organization',
    icon: Building,
    description: 'Manage units and departments',
  },
  {
    title: 'Users & Access',
    href: '/settings/users',
    icon: Users,
    description: 'Employee administration and roles',
  },
  {
    title: 'Ticket Configuration',
    href: '/settings/tickets',
    icon: Tag,
    description: 'Numbering, statuses, and priorities',
  },
  {
    title: 'Ticket Routing',
    href: '/settings/routing',
    icon: ListTodo,
    description: 'Manage technician routing & assignments',
  },
  {
    title: 'SLA & Escalation',
    href: '/settings/sla',
    icon: AlertTriangle,
    description: 'Service level agreements and deadlines',
  },
  {
    title: 'Notifications & Email',
    href: '/settings/notifications',
    icon: Bell,
    description: 'Email templates and event triggers',
  },
  {
    title: 'Asset Configuration',
    href: '/settings/assets',
    icon: Laptop,
    description: 'Asset categories and warnings',
  },
  {
    title: 'Help Center & KB',
    href: '/settings/knowledge',
    icon: BookOpen,
    description: 'Knowledge base configuration',
  },
  {
    title: 'Service Catalog',
    href: '/settings/services',
    icon: ListTodo,
    description: 'Service request management settings',
  },
  {
    title: 'Security',
    href: '/settings/security',
    icon: Shield,
    description: 'Authentication and session policies',
  },
  {
    title: 'Audit Logs',
    href: '/settings/audit-logs',
    icon: ScrollText,
    description: 'Immutable system change history',
  },
  {
    title: 'Data & Import',
    href: '/settings/data',
    icon: Database,
    description: 'Bulk import and export operations',
  },
  {
    title: 'System Info',
    href: '/settings/system',
    icon: Info,
    description: 'Application status and health',
  },
];

export function SettingsLayout() {
  const { profile, loading } = useAuthStore();

  const userRole = profile?.roles?.name || profile?.roles?.[0]?.name || profile?.role_name || profile?.role || 'Admin';

  if (loading) {
    return <div className="flex items-center justify-center h-[50vh]">Loading...</div>;
  }

  // Only Admin can access these settings
  if (userRole !== 'Admin') {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h2 className="text-2xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground max-w-md">
            You do not have administrative privileges to access the System Settings Control Center.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Control Center</h1>
        <p className="text-muted-foreground mt-2">
          Manage system configurations, organizational structure, and application behaviors.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-1/4 lg:w-1/5 shrink-0">
          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary hover:bg-primary/15'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <div className="flex flex-col text-left">
                  <span>{item.title}</span>
                </div>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 w-full min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
