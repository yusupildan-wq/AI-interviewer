import { Loader2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/LoginPage';
import { SignupPage } from '../features/auth/SignupPage';
import { FeedbackReportPage } from '../features/interview/FeedbackReportPage';
import { NewInterviewPage } from '../features/interview/NewInterviewPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { AuthProvider } from '../hooks/useAuth';
import { useSmoothScroll } from '../hooks/useSmoothScroll';
import { DashboardPage } from '../pages/DashboardPage';
import { LandingPage } from '../pages/LandingPage';

// Code-split: this route pulls in Monaco and the Three.js avatar, which are large
// and only needed once an interview actually starts.
const InterviewRoomPage = lazy(() =>
  import('../features/interview/InterviewRoomPage').then((m) => ({ default: m.InterviewRoomPage })),
);

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center text-graphite">
    <Loader2 className="animate-spin" size={20} aria-hidden="true" />
  </div>
);

export const App = () => {
  useSmoothScroll();

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/interview/new" element={<NewInterviewPage />} />
              <Route
                path="/interview/:sessionId"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <InterviewRoomPage />
                  </Suspense>
                }
              />
              <Route path="/interview/:sessionId/report" element={<FeedbackReportPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};
