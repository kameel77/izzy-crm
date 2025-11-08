import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ClientConsentsPage } from "./pages/ClientConsentsPage";
import { UserAdminPage } from "./pages/UserAdminPage";
import { AppLayout } from "./components/AppLayout";
import { ToastProvider } from "./providers/ToastProvider";
import { AnalyticsPage } from "./pages/AnalyticsPage";

export const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <ToastProvider />
      <Routes>
        <Route path="/client-form/consents" element={<ClientConsentsPage />} />
        <Route
          path="/login"
          element={user ? <Navigate to="/leads" replace /> : <LoginPage />}
        />
        <Route
          path="/leads/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute roles={["OPERATOR", "SUPERVISOR", "ADMIN"]}>
              <AppLayout>
                <AnalyticsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['ADMIN', 'SUPERVISOR']}>
              <AppLayout>
                <UserAdminPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to={user ? "/leads" : "/login"} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
