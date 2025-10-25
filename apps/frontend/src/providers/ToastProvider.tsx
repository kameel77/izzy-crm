import React from "react";
import { Toaster, ToasterProps } from "react-hot-toast";

export const ToastProvider: React.FC<ToasterProps> = (props) => (
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
);
