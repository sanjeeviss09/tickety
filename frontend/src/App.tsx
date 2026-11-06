import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useAuthStore } from './store/authStore';
import { Loader2 } from 'lucide-react';

// Layouts and Core Views (Synchronous for fast initial paint)
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { Dashboard } from './features/dashboard/Dashboard';
import { TicketList } from './features/tickets/components/TicketList';
import { TicketDetail } from './features/tickets/components/TicketDetail';

import { LoginForm } from './features/auth/components/LoginForm';
import { UpdatePassword } from './features/auth/components/UpdatePassword';

// Create a client
const queryClient = new QueryClient();

// Lazy Loaded Components
const TicketForm = lazy(() => import('./features/tickets/components/TicketForm').then(m => ({ default: m.TicketForm })));
const MyAssignedTickets = lazy(() => import('./features/technician/MyAssignedTickets').then(m => ({ default: m.MyAssignedTickets })));
const UnitQueue = lazy(() => import('./features/technician/UnitQueue').then(m => ({ default: m.UnitQueue })));

const UsersPage = lazy(() => import('./features/users/UsersPage').then(m => ({ default: m.UsersPage })));
const UnitsPage = lazy(() => import('./features/units/UnitsPage').then(m => ({ default: m.UnitsPage })));
const DepartmentsPage = lazy(() => import('./features/departments/DepartmentsPage').then(m => ({ default: m.DepartmentsPage })));
const ProfilePage = lazy(() => import('./features/users/ProfilePage').then(m => ({ default: m.ProfilePage })));
const DirectoryPage = lazy(() => import('./features/directory/DirectoryPage').then(m => ({ default: m.DirectoryPage })));
const EmployeeProfile = lazy(() => import('./features/directory/EmployeeProfile').then(m => ({ default: m.EmployeeProfile })));
const AddEmployeeForm = lazy(() => import('./features/directory/AddEmployeeForm').then(m => ({ default: m.AddEmployeeForm })));
const ImportEmployees = lazy(() => import('./features/directory/ImportEmployees').then(m => ({ default: m.ImportEmployees })));

const AssetList = lazy(() => import('./features/assets/components/AssetList').then(m => ({ default: m.AssetList })));
const AssetForm = lazy(() => import('./features/assets/components/AssetForm').then(m => ({ default: m.AssetForm })));
const AssetDetail = lazy(() => import('./features/assets/components/AssetDetail').then(m => ({ default: m.AssetDetail })));
const ImportAssets = lazy(() => import('./features/assets/components/ImportAssets').then(m => ({ default: m.ImportAssets })));

const AnalyticsPage = lazy(() => import('./features/analytics/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() => import('./features/reports/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const ScheduledReportsPage = lazy(() => import('./features/reports/pages/ScheduledReportsPage').then(m => ({ default: m.ScheduledReportsPage })));

const AttendanceDashboard = lazy(() => import('./features/workforce/pages/AttendanceDashboard').then(m => ({ default: m.AttendanceDashboard })));
const WorkforceRulesSettings = lazy(() => import('./features/workforce/pages/WorkforceRulesSettings').then(m => ({ default: m.WorkforceRulesSettings })));
const ShiftManagement = lazy(() => import('./features/workforce/pages/ShiftManagement').then(m => ({ default: m.ShiftManagement })));

const HelpCenterLayout = lazy(() => import('./features/helpcenter/HelpCenterLayout').then(m => ({ default: m.HelpCenterLayout })));
const KnowledgeBrowser = lazy(() => import('./features/knowledge/pages/KnowledgeBrowser').then(m => ({ default: m.KnowledgeBrowser })));
const ArticleView = lazy(() => import('./features/knowledge/pages/ArticleView').then(m => ({ default: m.ArticleView })));
const ServiceCatalogBrowser = lazy(() => import('./features/services/pages/ServiceCatalogBrowser').then(m => ({ default: m.ServiceCatalogBrowser })));
const ServiceRequestForm = lazy(() => import('./features/services/pages/ServiceRequestForm').then(m => ({ default: m.ServiceRequestForm })));
const FaqSopBrowser = lazy(() => import('./features/knowledge/pages/FaqSopBrowser').then(m => ({ default: m.FaqSopBrowser })));

const KnowledgeDashboard = lazy(() => import('./features/knowledge/admin/KnowledgeDashboard').then(m => ({ default: m.KnowledgeDashboard })));
const ArticleEditor = lazy(() => import('./features/knowledge/admin/ArticleEditor').then(m => ({ default: m.ArticleEditor })));
const ServiceCatalogManager = lazy(() => import('./features/services/admin/ServiceCatalogManager').then(m => ({ default: m.ServiceCatalogManager })));

const SettingsLayout = lazy(() => import('./features/settings/SettingsLayout').then(m => ({ default: m.SettingsLayout })));
const GeneralSettings = lazy(() => import('./features/settings/pages/GeneralSettings').then(m => ({ default: m.GeneralSettings })));
const CompanySettings = lazy(() => import('./features/settings/pages/CompanySettings').then(m => ({ default: m.CompanySettings })));
const OrganizationSettings = lazy(() => import('./features/settings/pages/OrganizationSettings').then(m => ({ default: m.OrganizationSettings })));
const UsersAccessSettings = lazy(() => import('./features/settings/pages/UsersAccessSettings').then(m => ({ default: m.UsersAccessSettings })));
const TicketSettings = lazy(() => import('./features/settings/pages/TicketSettings').then(m => ({ default: m.TicketSettings })));
const NotificationSettings = lazy(() => import('./features/settings/pages/NotificationSettings').then(m => ({ default: m.NotificationSettings })));
const AssetSettings = lazy(() => import('./features/settings/pages/AssetSettings').then(m => ({ default: m.AssetSettings })));
const KnowledgeSettings = lazy(() => import('./features/settings/pages/KnowledgeSettings').then(m => ({ default: m.KnowledgeSettings })));
const ServiceCatalogSettings = lazy(() => import('./features/settings/pages/ServiceCatalogSettings').then(m => ({ default: m.ServiceCatalogSettings })));
const SecuritySettings = lazy(() => import('./features/settings/pages/SecuritySettings').then(m => ({ default: m.SecuritySettings })));
const SlaSettings = lazy(() => import('./features/settings/pages/SlaSettings').then(m => ({ default: m.SlaSettings })));
const AuditLogSettings = lazy(() => import('./features/settings/pages/AuditLogSettings').then(m => ({ default: m.AuditLogSettings })));
const DataSettings = lazy(() => import('./features/settings/pages/DataSettings').then(m => ({ default: m.DataSettings })));
const SystemInfoSettings = lazy(() => import('./features/settings/pages/SystemInfoSettings').then(m => ({ default: m.SystemInfoSettings })));
const RoutingSettings = lazy(() => import('./features/settings/pages/RoutingSettings').then(m => ({ default: m.RoutingSettings })));

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { profile, loading } = useAuthStore();
  if (loading) return null;
  if (!profile || !allowedRoles.includes(profile.roles?.name)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

import { ErrorBoundary } from './components/ErrorBoundary';

const PageLoader = () => (
  <div className="flex h-[calc(100vh-64px)] items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginForm />} />
              <Route path="/update-password" element={<UpdatePassword />} />
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
              <Route path="/workforce/attendance" element={<ProtectedRoute allowedRoles={['Admin', 'Technician']}><AttendanceDashboard /></ProtectedRoute>} />
              <Route path="/settings/workforce/rules" element={<ProtectedRoute allowedRoles={['Admin']}><WorkforceRulesSettings /></ProtectedRoute>} />
              <Route path="/settings/workforce/shifts" element={<ProtectedRoute allowedRoles={['Admin']}><ShiftManagement /></ProtectedRoute>} />
              
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
        </Suspense>
      </BrowserRouter>
      <SpeedInsights />
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
