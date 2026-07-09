import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { AppLayout } from './components';
import {
  DashboardPage,
  LearningSpacePage,
  ExamCenterPage,
  ResultsPage,
} from './pages';

export const App: React.FC = () => {
  const auth = useAuth();

  React.useEffect(() => {
    const handleAuthExpired = () => {
      if (!auth.isLoading) {
        void auth.signinRedirect();
      }
    };

    window.addEventListener('smartstudy:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('smartstudy:auth-expired', handleAuthExpired);
  }, [auth]);

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] text-[#232F3E]">
        <div className="text-center">
          <div className="mx-auto mb-5 h-10 w-10 rounded-full border-4 border-[#D0E4FF] border-t-[#0073BB] animate-spin" />
          <p className="text-sm font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] px-6 text-[#232F3E]">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-3">Unable to sign in</h1>
          <p className="text-sm text-[#707882] mb-6">{auth.error.message}</p>
          <button
            onClick={() => void auth.signinRedirect()}
            className="rounded-lg bg-[#0073BB] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#005f99] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] px-6 text-[#232F3E]">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#0073BB] to-[#8A2BE2] text-white shadow-md">
            <span className="text-xl font-black">S</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-3">SmartStudy</h1>
          <p className="text-sm text-[#707882] mb-8">Please sign in to continue.</p>
          <button
            onClick={() => void auth.signinRedirect()}
            className="w-full rounded-lg bg-[#0073BB] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#005f99] transition-colors"
          >
            Sign in with Cognito
          </button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/learning" element={<LearningSpacePage />} />
          <Route path="/exam-center" element={<ExamCenterPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
