import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ChatPage } from './pages/ChatPage';
import { ProfilePage } from './pages/ProfilePage';
import { GoalsPage } from './pages/GoalsPage';
import { StoryPage } from './pages/StoryPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { ClinicianPage } from './pages/ClinicianPage';
import { ClinicianSessionPage } from './pages/ClinicianSessionPage';
import { useAuth } from './hooks/useAuth';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  if (!isReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireClinician({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isReady } = useAuth();
  if (!isReady) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'clinician' && user?.role !== 'admin') return <Navigate to="/chat" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/goals"
          element={
            <RequireAuth>
              <GoalsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/story"
          element={
            <RequireAuth>
              <StoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/documents"
          element={
            <RequireAuth>
              <DocumentsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/feedback"
          element={
            <RequireAuth>
              <FeedbackPage />
            </RequireAuth>
          }
        />
        <Route
          path="/clinician"
          element={
            <RequireClinician>
              <ClinicianPage />
            </RequireClinician>
          }
        />
        <Route
          path="/clinician/sessions/:sessionId"
          element={
            <RequireClinician>
              <ClinicianSessionPage />
            </RequireClinician>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AppShell>
  );
}
