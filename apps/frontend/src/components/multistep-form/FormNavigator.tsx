import React from "react";

interface FormNavigatorProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isSubmittable?: boolean;
}

export const FormNavigator: React.FC<FormNavigatorProps> = ({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isSubmittable = true,
}) => {
  return (
    <div style={styles.navigator}>
      <button
        style={{...styles.button, background: '#64748b'}}
        onClick={onBack}
        disabled={currentStep === 1}
      >
        Wstecz
      </button>
      {currentStep === totalSteps ? (
        <button
          style={{
            ...styles.button,
            ...(isSubmittable
              ? {}
              : {
                  background: "#94a3b8",
                  color: "#e2e8f0",
                  borderColor: "transparent",
                  cursor: "not-allowed",
                  opacity: 0.85,
                }),
          }}
          onClick={onSubmit}
          disabled={!isSubmittable}
        >
          Wyślij wniosek
        </button>
      ) : (
        <button
          style={styles.button}
          onClick={onNext}
        >
          Dalej
        </button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  navigator: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "2rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #e5e7eb",
  },
  button: {
    padding: "0.75rem 1.5rem",
    border: "1px solid transparent",
    borderRadius: "0.5rem",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
    background: "#2563eb",
    color: "#ffffff",
  },
};
