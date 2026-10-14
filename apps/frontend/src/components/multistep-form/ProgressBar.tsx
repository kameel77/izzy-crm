import React from "react";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps }) => {
  const percentage = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="app-client-progress">
      <p className="app-client-progress__label">
        Krok {currentStep} z {totalSteps}
      </p>
      <div className="app-client-progress__track">
        <div className="app-client-progress__fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};
