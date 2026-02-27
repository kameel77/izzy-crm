import React from "react";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
  const percentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div style={styles.container}>
      <p style={styles.label}>
        Krok {currentStep} z {totalSteps}
      </p>
      <div style={styles.bar}>
        <div style={{ ...styles.progress, width: `${percentage}%` }} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: "2rem",
  },
  label: {
    fontSize: "0.875rem",
    color: "#475569",
    textAlign: "center",
    marginBottom: "0.5rem",
  },
  bar: {
    height: "8px",
    background: "#e2e8f0",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progress: {
    height: "100%",
    background: "linear-gradient(135deg, hsl(24, 95%, 53%) 0%, hsl(28, 95%, 48%) 100%)",
    borderRadius: "4px",
    transition: "width 0.3s ease-in-out",
  },
};
