import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, ProtectedRoute } from './contexts/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import InstanceDetail from './pages/InstanceDetail';
import SupabaseManager from './pages/SupabaseManager';
import Alerts from './pages/Alerts';
import AlertRules from './pages/AlertRules';
import ResetPassword from './pages/ResetPassword';
import UserManagement from './pages/UserManagement';
import BackupManagement from './pages/BackupManagement';
import UserProfile from './pages/UserProfile';
import NotificationSettings from './pages/NotificationSettings';
import ActivityLog from './pages/ActivityLog';
import ApiKeys from './pages/ApiKeys';
import ApiDocs from './pages/ApiDocs';
import Templates from './pages/Templates';
import Migrations from './pages/Migrations';
import GlobalSmtpSettings from './pages/GlobalSmtpSettings';
import SetupLayout from './layouts/SetupLayout';
import SetupPage from './pages/SetupPage';
import { useWebSocket } from './hooks/useWebSocket';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

import LandingPage from './pages/LandingPage';

function AppContent() {
  // Initialize WebSocket connection for real-time updates
  useWebSocket();

  return (
    <div className='min-h-screen bg-background text-foreground font-sans'>
      <Toaster position='top-right' richColors />
      <Routes>
        {/* Public Routes */}
        <Route path='/' element={<LandingPage />} />
        <Route path='/reset-password' element={<ResetPassword />} />
        {/* Redirect old auth routes to landing page */}
        <Route path='/login' element={<Navigate to='/' replace />} />
        <Route path='/register' element={<Navigate to='/' replace />} />
        <Route path='/forgot-password' element={<Navigate to='/' replace />} />
        <Route path='/verify-email' element={<Navigate to='/' replace />} />

        {/* Protected Routes with Dashboard Layout */}
        <Route
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path='/dashboard' element={<Dashboard />} />
          <Route path='/instances/:name' element={<InstanceDetail />} />
          <Route path='/instances/:name/supabase' element={<SupabaseManager />} />
          <Route path='/alerts' element={<Alerts />} />
          <Route path='/alert-rules' element={<AlertRules />} />
          <Route path='/backups' element={<BackupManagement />} />
          <Route path='/profile' element={<UserProfile />} />
          <Route path='/notifications' element={<NotificationSettings />} />
          <Route path='/api-keys' element={<ApiKeys />} />
          <Route path='/api-docs' element={<ApiDocs />} />
          <Route path='/templates' element={<Templates />} />
        </Route>

        {/* Admin Routes with Dashboard Layout */}
        <Route
          element={
            <ProtectedRoute requireAdmin>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route path='/users' element={<UserManagement />} />
          <Route path='/migrations' element={<Migrations />} />
          <Route path='/activity' element={<ActivityLog />} />
          <Route path='/settings/smtp' element={<GlobalSmtpSettings />} />
        </Route>
        {/* Setup Routes */}
        <Route path='/setup' element={<SetupLayout />}>
          <Route index element={<Navigate to='/setup/getting-started/requirements' replace />} />
          <Route path=':category/:slug' element={<SetupPage />} />
        </Route>
        {/* Fallback to Landing Page */}
        <Route path='*' element={<Navigate to='/' replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
