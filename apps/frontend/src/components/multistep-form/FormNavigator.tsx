import React from "react";

import { Button } from "../ui";

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
    <div className="form-navigator">
      <Button variant="secondary" size="lg" icon="chevron-left" onClick={onBack} disabled={currentStep === 1}>
        Wstecz
      </Button>
      {currentStep === totalSteps ? (
        <Button variant="primary" size="lg" onClick={onSubmit} disabled={!isSubmittable}>
          Wyślij wniosek
        </Button>
      ) : (
        <Button variant="primary" size="lg" iconRight="chevron-right" onClick={onNext}>
          Dalej
        </Button>
      )}
    </div>
  );
};
