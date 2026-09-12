import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function AuthLayout() {
  const { session, loading } = useAuthStore();

  const { data: publicConfig, isLoading: configLoading } = useQuery({
    queryKey: ['publicConfig'],
    queryFn: async () => {
      const res = await api.get('/public/config');
      return res.data.data;
    }
  });

  const appName = publicConfig?.app_name || 'DeskPulse';

  if (loading || configLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <Outlet />
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block">
        <div className="absolute inset-0 h-full w-full bg-primary flex items-center justify-center text-primary-foreground p-12 text-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-4">{appName}</h1>
            <p className="text-lg text-primary-foreground/80">Enterprise Help Desk & Ticket Management System</p>
          </div>
        </div>
      </div>
    </div>
  );
}
