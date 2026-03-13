import React, { useState } from "react";
import { MultiStepForm } from "../components/multistep-form/MultiStepForm";

export const ApplicationFormPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        {currentStep === 1 ? (
          <>
            <h1 style={styles.title}>Wniosek o finansowanie</h1>
            <p style={styles.subtitle}>
              Wypełnij poniższy formularz, aby złożyć wniosek. Możesz zapisać postęp i wrócić w dowolnym momencie.
            </p>
          </>
        ) : (
          <h1 style={styles.titleSmall}>Wniosek o finansowanie</h1>
        )}
      </header>
      <main className="form-main-card">
        <MultiStepForm onStepChange={setCurrentStep} />
      </main>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#f4f6fb",
    width: "100%",
    minHeight: "100vh",
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
  titleSmall: {
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#1e293b",
    marginBottom: "0.5rem",
  },
  subtitle: {
    fontSize: "1.125rem",
    color: "#475569",
    marginTop: 0,
  },
};
