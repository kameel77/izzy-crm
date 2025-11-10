import React, { createContext, useCallback, useContext, useMemo } from "react";
import toast, { Toaster, ToasterProps } from "react-hot-toast";

interface ToastContextValue {
  addToast: (message: string, type?: "success" | "error" | "info") => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<React.PropsWithChildren<ToasterProps>> = ({ children, ...props }) => {
  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    switch (type) {
      case "success":
        toast.success(message);
        break;
      case "error":
        toast.error(message);
        break;
      case "info":
      default:
        toast(message);
        break;
    }
  }, []);

  const value = useMemo(() => ({ addToast }), [addToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "10px",
            background: "#0f172a",
            color: "#f8fafc",
          },
        }}
        {...props}
      />
    </ToastContext.Provider>
  );
};

export const useToasts = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToasts must be used within a ToastProvider");
  }
  return context;
};