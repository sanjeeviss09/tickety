import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { TicketList } from './features/tickets/components/TicketList';
import { TicketDetail } from './features/tickets/components/TicketDetail';
import { TicketForm } from './features/tickets/components/TicketForm';
import { MyAssignedTickets } from './features/technician/MyAssignedTickets';
import { UnitQueue } from './features/technician/UnitQueue';

import { LoginForm } from './features/auth/components/LoginForm';

// Create a client
const queryClient = new QueryClient();

import { UsersPage } from './features/users/UsersPage';
import { UnitsPage } from './features/units/UnitsPage';
import { DepartmentsPage } from './features/departments/DepartmentsPage';
import { ProfilePage } from './features/users/ProfilePage';
import { DirectoryPage } from './features/directory/DirectoryPage';
import { EmployeeProfile } from './features/directory/EmployeeProfile';
import { AddEmployeeForm } from './features/directory/AddEmployeeForm';
import { ImportEmployees } from './features/directory/ImportEmployees';

// Placeholder components for routes
import { AssetList } from './features/assets/components/AssetList';
import { AssetForm } from './features/assets/components/AssetForm';
import { AssetDetail } from './features/assets/components/AssetDetail';
import { ImportAssets } from './features/assets/components/ImportAssets';

import { AnalyticsPage } from './features/analytics/pages/AnalyticsPage';
import { ReportsPage } from './features/reports/pages/ReportsPage';
import { ScheduledReportsPage } from './features/reports/pages/ScheduledReportsPage';
import { HelpCenterLayout } from './features/helpcenter/HelpCenterLayout';
import { KnowledgeBrowser } from './features/knowledge/pages/KnowledgeBrowser';
import { ArticleView } from './features/knowledge/pages/ArticleView';
import { ServiceCatalogBrowser } from './features/services/pages/ServiceCatalogBrowser';
import { ServiceRequestForm } from './features/services/pages/ServiceRequestForm';
import { FaqSopBrowser } from './features/knowledge/pages/FaqSopBrowser';
import { KnowledgeDashboard } from './features/knowledge/admin/KnowledgeDashboard';
import { ArticleEditor } from './features/knowledge/admin/ArticleEditor';
import { ServiceCatalogManager } from './features/services/admin/ServiceCatalogManager';
import { SettingsLayout } from './features/settings/SettingsLayout';
import { GeneralSettings } from './features/settings/pages/GeneralSettings';
import { CompanySettings } from './features/settings/pages/CompanySettings';
import { OrganizationSettings } from './features/settings/pages/OrganizationSettings';
import { UsersAccessSettings } from './features/settings/pages/UsersAccessSettings';
import { TicketSettings } from './features/settings/pages/TicketSettings';
import { NotificationSettings } from './features/settings/pages/NotificationSettings';
import { AssetSettings } from './features/settings/pages/AssetSettings';
import { KnowledgeSettings } from './features/settings/pages/KnowledgeSettings';
import { ServiceCatalogSettings } from './features/settings/pages/ServiceCatalogSettings';
import { SecuritySettings } from './features/settings/pages/SecuritySettings';
import { SlaSettings } from './features/settings/pages/SlaSettings';
import { AuditLogSettings } from './features/settings/pages/AuditLogSettings';
import { DataSettings } from './features/settings/pages/DataSettings';
import { SystemInfoSettings } from './features/settings/pages/SystemInfoSettings';
import { RoutingSettings } from './features/settings/pages/RoutingSettings';

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { profile, loading } = useAuthStore();
  if (loading) return null;
  if (!profile || !allowedRoles.includes(profile.roles?.name)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginForm />} />
          </Route>

          {/* Protected Dashboard Routes */}
          <Route element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/tickets" element={<TicketList />} />
            <Route path="/tickets/assigned" element={<MyAssignedTickets />} />
            <Route path="/tickets/queue" element={<UnitQueue />} />
            <Route path="/tickets/new" element={<TicketForm />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/assets" element={<AssetList />} />
            <Route path="/assets/new" element={<AssetForm />} />
            <Route path="/assets/import" element={<ImportAssets />} />
            <Route path="/assets/:id" element={<AssetDetail />} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/reports/scheduled" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><ScheduledReportsPage /></ProtectedRoute>} />
            
            <Route path="/help-center" element={<HelpCenterLayout />}>
              <Route index element={<KnowledgeBrowser />} />
              <Route path="article/:slug" element={<ArticleView />} />
              <Route path="services" element={<ServiceCatalogBrowser />} />
              <Route path="services/:id" element={<ServiceRequestForm />} />
              <Route path="faqs" element={<FaqSopBrowser />} />
              <Route path="sops" element={<FaqSopBrowser />} />
            </Route>
            
            <Route path="/kb-admin" element={<KnowledgeDashboard />} />
            <Route path="/kb-admin/articles/new" element={<ArticleEditor />} />
            <Route path="/kb-admin/articles/:id/edit" element={<ArticleEditor />} />
            <Route path="/service-admin" element={<ServiceCatalogManager />} />
            
            <Route path="/directory" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><DirectoryPage /></ProtectedRoute>} />
            <Route path="/directory/add" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><AddEmployeeForm /></ProtectedRoute>} />
            <Route path="/directory/import" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><ImportEmployees /></ProtectedRoute>} />
            <Route path="/directory/:id" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><EmployeeProfile /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['Admin']}><UsersPage /></ProtectedRoute>} />
            <Route path="/units" element={<ProtectedRoute allowedRoles={['Admin']}><UnitsPage /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute allowedRoles={['Admin']}><DepartmentsPage /></ProtectedRoute>} />
            
            <Route path="/settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="general" replace />} />
              <Route path="general" element={<GeneralSettings />} />
              <Route path="company" element={<CompanySettings />} />
              <Route path="organization" element={<OrganizationSettings />} />
              <Route path="users" element={<UsersAccessSettings />} />
              <Route path="tickets" element={<TicketSettings />} />
              <Route path="routing" element={<RoutingSettings />} />
              <Route path="notifications" element={<NotificationSettings />} />
              <Route path="assets" element={<AssetSettings />} />
              <Route path="knowledge" element={<KnowledgeSettings />} />
              <Route path="services" element={<ServiceCatalogSettings />} />
              <Route path="security" element={<SecuritySettings />} />
              <Route path="sla" element={<SlaSettings />} />
              <Route path="audit-logs" element={<AuditLogSettings />} />
              <Route path="data" element={<DataSettings />} />
              <Route path="system" element={<SystemInfoSettings />} />
              {/* Other settings routes will be added here */}
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
