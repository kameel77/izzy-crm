import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useDebounce } from "use-debounce";
import { getApplicationForm, saveApplicationFormProgress } from "../../api/application-forms";
import { FormNavigator } from "./FormNavigator";
import { ProgressBar } from "./ProgressBar";
import { Step1_PersonalData, Step1Ref } from "./steps/Step1_PersonalData";
import { Step2_IdentityDocument, Step2Ref } from "./steps/Step2_IdentityDocument";
import { Step3_Addresses, Step3Ref } from "./steps/Step3_Addresses";
import { Step4_Employment, Step4Ref } from "./steps/Step4_Employment";
import { Step5_Budget, Step5Ref } from "./steps/Step5_Budget";
import { Step6_Summary } from "./steps/Step6_Summary";

const TOTAL_STEPS = 6;

type StepRef = Step1Ref | Step2Ref | Step3Ref | Step4Ref | Step5Ref;

const renderStep = (
  step: number,
  ref: React.Ref<StepRef>,
  formData: Record<string, unknown>,
  handleFormChange: (data: Record<string, unknown>) => void,
  onValidityChange: (isValid: boolean) => void,
  submitAttempted: boolean,
) => {
  // Component mapping logic remains the same
  switch (step) {
    case 1:
      return <Step1_PersonalData ref={ref as React.Ref<Step1Ref>} onFormChange={handleFormChange} formData={formData} />;
    case 2:
      return <Step2_IdentityDocument ref={ref as React.Ref<Step2Ref>} onFormChange={handleFormChange} formData={formData} />;
    case 3:
      return <Step3_Addresses ref={ref as React.Ref<Step3Ref>} onFormChange={handleFormChange} formData={formData} />;
    case 4:
      return <Step4_Employment ref={ref as React.Ref<Step4Ref>} onFormChange={handleFormChange} formData={formData} />;
    case 5:
      return <Step5_Budget ref={ref as React.Ref<Step5Ref>} onFormChange={handleFormChange} formData={formData} />;
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

const AutoSaveStatus: React.FC<{ status: string }> = ({ status }) => (
  <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.875rem', height: '20px' }}>
    {status === 'saving' && 'Zapisywanie...'}
    {status === 'saved' && 'Zapisano.'}
    {status === 'error' && 'Błąd zapisu.'}
  </div>
);

export const MultiStepForm: React.FC = () => {
  const { applicationFormId } = useParams<{ applicationFormId: string }>();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [isStepValid, setIsStepValid] = useState(true);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [isLoading, setIsLoading] = useState(true);
  const isSavingRef = useRef(false);

  const [debouncedFormData] = useDebounce(formData, 3000);

  const stepRefs = useRef<Array<React.RefObject<StepRef>>>([]);
  stepRefs.current = Array(TOTAL_STEPS).fill(null).map((_, i) => stepRefs.current[i] ?? React.createRef<StepRef>());

  useEffect(() => {
    const loadFormData = async () => {
      if (!applicationFormId) {
        setIsLoading(false);
        return;
      }
      try {
        const savedForm = await getApplicationForm(applicationFormId);
        if (savedForm && savedForm.formData) {
          setFormData(savedForm.formData);
        }
        if (savedForm && savedForm.currentStep) {
          setCurrentStep(savedForm.currentStep);
        }
      } catch (error) {
        console.error("Failed to load form data", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFormData();
  }, [applicationFormId]);

  useEffect(() => {
    const performSave = async () => {
      if (isLoading || isSavingRef.current || !applicationFormId || Object.keys(debouncedFormData).length === 0) {
        return;
      }

      isSavingRef.current = true;
      setSaveStatus('saving');
      try {
        const completionPercent = Math.round(((currentStep - 1) / TOTAL_STEPS) * 100);
        await saveApplicationFormProgress(applicationFormId, {
          formData: debouncedFormData,
          currentStep,
          completionPercent,
        });
        setSaveStatus('saved');
      } catch (error) {
        console.error("Failed to save data to backend", error);
        setSaveStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    };

    performSave();
  }, [debouncedFormData, currentStep, applicationFormId, isLoading]);

  const handleNext = async () => {
    const currentStepRef = stepRefs.current[currentStep - 1]?.current;
    if (currentStepRef) {
      await currentStepRef.triggerValidation();
    }
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setSubmitAttempted(false);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFormChange = useCallback((newData: object) => {
    setFormData((prev) => ({ ...prev, ...newData }));
    setSaveStatus('idle');
  }, []);

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    const stepValidationPromises = stepRefs.current
      .slice(0, 5)
      .map(ref => ref.current?.triggerValidation() ?? Promise.resolve(false));
    const validationResults = await Promise.all(stepValidationPromises);
    const areAllStepsValid = validationResults.every(isValid => isValid);

    if (areAllStepsValid && isStepValid) {
      console.log("Form submitted:", formData);
      alert("Wniosek wysłany! (sprawdź konsolę)");
    } else {
      console.log("Form invalid, submission blocked.");
      alert("Proszę uzupełnić wszystkie wymagane pola i zgody.");
    }
  };

  if (isLoading) {
    return <div>Ładowanie...</div>;
  }

  return (
    <div>
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      <AutoSaveStatus status={saveStatus} />
      
      <div style={{ minHeight: "300px", padding: "1rem 0" }}>
        {renderStep(
          currentStep,
          stepRefs.current[currentStep - 1],
          formData,
          handleFormChange,
          setIsStepValid,
          submitAttempted,
        )}
      </div>

      <FormNavigator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isSubmittable={currentStep === TOTAL_STEPS}
      />
    </div>
  );
};
