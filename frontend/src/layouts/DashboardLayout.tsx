import { useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { 
  LayoutDashboard, Users, 
  Settings, LogOut, Menu, Bell, Search, Ticket, Database,
  BarChart2, FileText, Book, ShieldAlert, Check, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DashboardLayout() {
  const { session, profile, loading, signOut } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    directory: false,
    assets: false
  });
  const location = useLocation();
  const queryClient = useQueryClient();

  // Notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      if (!session) return [];
      const res = await api.get('/notifications');
      return res.data.data;
    },
    enabled: !!session,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => await api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => await api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  // Public Config
  const { data: publicConfig } = useQuery({
    queryKey: ['publicConfig'],
    queryFn: async () => {
      const res = await api.get('/public/config');
      return res.data.data;
    },
  });

  const appName = publicConfig?.app_name || 'DeskPulse';
  const appInitials = appName.substring(0, 2).toUpperCase();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = profile?.roles?.name === 'Admin';
  
  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { 
      name: 'Tickets', 
      icon: Ticket,
      id: 'tickets',
      children: [
        { name: 'All Tickets', href: '/tickets' },
        ...(profile?.roles?.name === 'Technician' || isAdmin ? [
          { name: 'My Assigned Tickets', href: '/tickets/assigned' },
          { name: 'Unit Queue', href: '/tickets/queue' }
        ] : [])
      ]
    },
    ...(isAdmin || profile?.roles?.name === 'Technician' ? [{ 
      name: 'Directory', 
      icon: Users,
      id: 'directory',
      children: [
        { name: 'Employee List', href: '/directory' },
        { name: 'Add Employee', href: '/directory/add' },
        { name: 'Import Employees', href: '/directory/import' },
      ]
    }] : []),
    { 
      name: 'Assets', 
      icon: Database,
      id: 'assets',
      children: [
        { name: 'Asset Inventory', href: '/assets' },
        ...(isAdmin || profile?.roles?.name === 'Technician' ? [
          { name: 'Add Asset', href: '/assets/add' },
          { name: 'Import Assets', href: '/assets/import' }
        ] : [])
      ]
    },
    { name: 'Help Center', href: '/help-center', icon: Book },
    ...(isAdmin || profile?.roles?.name === 'Technician' ? [
      { name: 'Analytics', href: '/analytics', icon: BarChart2 },
      { name: 'Reports', href: '/reports', icon: FileText },
    ] : []),
    ...(isAdmin ? [
      { name: 'KB Admin', href: '/kb-admin', icon: Book },
      { name: 'Service Admin', href: '/service-admin', icon: ShieldAlert },
      { name: 'Settings', href: '/settings', icon: Settings },
    ] : [])
  ];

  const toggleMenu = (id: string) => {
    setExpandedMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Desktop */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r bg-card">
        <div className="flex h-14 items-center border-b px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary truncate max-w-full">
            <div className="bg-primary text-primary-foreground p-1 rounded-md shrink-0">{appInitials}</div>
            <span className="truncate">{appName}</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {navigation.map((item) => (
              <div key={item.name}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => item.id && toggleMenu(item.id)}
                      className={cn(
                        'w-full group flex items-center justify-between px-2 py-2 text-sm rounded-md transition-colors',
                        (location.pathname.startsWith(`/${item.id}`) || expandedMenus[item.id!])
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <div className="flex items-center">
                        <item.icon className="mr-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
                        {item.name}
                      </div>
                      {expandedMenus[item.id!] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    {expandedMenus[item.id!] && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.children.map(child => (
                          <Link
                            key={child.name}
                            to={child.href}
                            className={cn(
                              'block px-2 py-1.5 text-sm rounded-md transition-colors',
                              location.pathname === child.href
                                ? 'text-primary font-medium bg-primary/5'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                            )}
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.href!}
                    className={cn(
                      location.pathname === item.href
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      'group flex items-center px-2 py-2 text-sm rounded-md transition-colors'
                    )}
                  >
                    <item.icon
                      className={cn(
                        location.pathname === item.href ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                        'mr-3 flex-shrink-0 h-5 w-5 transition-colors'
                      )}
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="ml-3 font-bold text-lg text-primary truncate">{appName}</span>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            {/* Breadcrumb Placeholder */}
            <span>Dashboard</span>
            <span>/</span>
            <span className="text-foreground capitalize">{location.pathname.split('/')[1] || 'Overview'}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Global search..."
                className="w-64 rounded-md bg-muted/50 pl-9 focus-visible:ring-1"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => markAllAsRead.mutate()}>
                      <Check className="h-3 w-3 mr-1" /> Mark all read
                    </Button>
                  )}
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="h-72">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
                  ) : (
                    notifications.map((n: any) => (
                      <div key={n.id} className={cn("p-3 text-sm border-b last:border-0 hover:bg-muted/50 cursor-default", !n.is_read && "bg-muted/30")}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium">{n.title}</span>
                          {!n.is_read && (
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => markAsRead.mutate(n.id)}>
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-muted-foreground text-xs">{n.message}</p>
                        <span className="text-[10px] text-muted-foreground block mt-2">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.profile_picture_url} alt={profile?.full_name} />
                    <AvatarFallback>{profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.full_name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {profile?.email_address}
                    </p>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {profile?.roles?.name}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay placeholder */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 bg-card border-r shadow-lg flex flex-col p-4 z-50">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-lg text-primary truncate pr-2">{appName}</span>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <span className="sr-only">Close sidebar</span>
                &times;
              </Button>
            </div>
            <nav className="space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href || '#'}
                  className={cn(
                    location.pathname === item.href
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    'flex items-center px-2 py-2 text-sm rounded-md'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
