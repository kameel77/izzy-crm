import React, { useState, useEffect, useCallback } from "react";
import { FormNavigator } from "./FormNavigator";
import { ProgressBar } from "./ProgressBar";
import { Step1_PersonalData } from "./steps/Step1_PersonalData";
import { Step2_IdentityDocument } from "./steps/Step2_IdentityDocument";
import { Step3_Addresses } from "./steps/Step3_Addresses";
import { Step4_Employment } from "./steps/Step4_Employment";
import { Step5_Budget } from "./steps/Step5_Budget";
import { Step6_Summary } from "./steps/Step6_Summary";

const TOTAL_STEPS = 6;

const renderStep = (
  step: number,
  formData: any,
  handleFormChange: (data: any) => void,
  onValidityChange: (isValid: boolean) => void,
  submitAttempted: boolean,
) => {
  switch (step) {
    case 1:
      return <Step1_PersonalData onFormChange={handleFormChange} formData={formData} />;
    case 2:
      return <Step2_IdentityDocument onFormChange={handleFormChange} formData={formData} />;
    case 3:
      return <Step3_Addresses onFormChange={handleFormChange} formData={formData} />;
    case 4:
      return <Step4_Employment onFormChange={handleFormChange} formData={formData} />;
    case 5:
      return <Step5_Budget onFormChange={handleFormChange} formData={formData} />;
    case 6:
      return (
        <Step6_Summary
          formData={formData}
          onValidityChange={onValidityChange}
          submitAttempted={submitAttempted}
        />
      );
    default:
      return <p>Nieznany krok</p>;
  }
};

export const MultiStepForm: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [isStepValid, setIsStepValid] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    // For steps 1-5, we assume they are valid until full validation is built.
    // For step 6, validity is managed by the callback from the component itself.
    if (currentStep < 6) {
      setIsStepValid(true);
    }
  }, [currentStep]);

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setSubmitAttempted(false); // Reset submit attempt on navigating back
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFormChange = useCallback((newData: object) => {
    setFormData((prev) => ({ ...prev, ...newData }));
  }, []); // Empty dependency array means this function is created once

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (isStepValid) {
      console.log("Form submitted:", formData);
      alert("Wniosek wysłany! (sprawdź konsolę)");
    } else {
      console.log("Form invalid, submission blocked.");
    }
  };

  return (
    <div>
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      <div style={{ minHeight: "300px", padding: "1rem 0" }}>
        {renderStep(currentStep, formData, handleFormChange, setIsStepValid, submitAttempted)}
      </div>

      <FormNavigator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isSubmittable={currentStep === TOTAL_STEPS && isStepValid}
      />
    </div>
  );
};
