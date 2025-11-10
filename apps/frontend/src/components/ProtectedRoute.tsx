import React, { useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { useToasts } from "../providers/ToastProvider";

interface ProtectedRouteProps {
  children: React.ReactElement;
  roles?: string[];
  unauthorizedRedirect?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  roles,
  unauthorizedRedirect = "/leads",
}) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const toast = useToasts();
  const hasWarnedRef = useRef(false);

  if (isLoading) {
    return <div style={styles.loader}>Validating your session…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    if (!hasWarnedRef.current) {
      toast.error("You do not have access to that area. Redirected to your workspace.");
      hasWarnedRef.current = true;
    }
    return <Navigate to={unauthorizedRedirect} replace state={{ from: location, reason: "unauthorized" }} />;
  }

  return children;
};

const styles: Record<string, React.CSSProperties> = {
  loader: {
    padding: "2rem",
    textAlign: "center",
    color: "#475569",
  },
};
