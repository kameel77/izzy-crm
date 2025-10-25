import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { UserAdminPage } from "./pages/UserAdminPage";
import { AppLayout } from "./components/AppLayout";
import { ToastProvider } from "./providers/ToastProvider";

export const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <ToastProvider />
      <Routes>
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
