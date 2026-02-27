import React from "react";
import { MultiStepForm } from "../components/multistep-form/MultiStepForm";

export const ApplicationFormPage: React.FC = () => {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>Wniosek o finansowanie</h1>
        <p style={styles.subtitle}>
          Wypełnij poniższy formularz, aby złożyć wniosek. Możesz zapisać postęp i wrócić w dowolnym momencie.
        </p>
      </header>
      <main style={styles.main}>
        <MultiStepForm />
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#f4f6fb",
    width: "100%",
    minHeight: "100vh",
    padding: "2rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  header: {
    width: "100%",
    maxWidth: "800px",
    margin: "0 auto 2rem auto",
    textAlign: "center",
  },
  title: {
    fontSize: "2.25rem",
    fontWeight: 700,
    color: "#1e293b",
    marginBottom: "0.5rem",
  },
  subtitle: {
    fontSize: "1.125rem",
    color: "#475569",
    marginTop: 0,
  },
  main: {
    width: "100%",
    maxWidth: "800px",
    margin: "0 auto",
    background: "#ffffff",
    borderRadius: "1rem",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    padding: "2rem",
  },
};
