import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ClientConsentsPage } from "./pages/ClientConsentsPage";
import { UserAdminPage } from "./pages/UserAdminPage";
import { AppLayout } from "./components/AppLayout";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { ApplicationFormPage } from "./pages/ApplicationFormPage";
import { AdminConsentsPage } from "./pages/AdminConsentsPage";

export const App: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/client-form/consents" element={<ClientConsentsPage />} />
      <Route path="/client-form/:applicationFormId/:leadId" element={<ApplicationFormPage />} />
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
      <Route
        path="/admin/consents"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AppLayout>
              <AdminConsentsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/application-form"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ApplicationFormPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={user ? "/leads" : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
