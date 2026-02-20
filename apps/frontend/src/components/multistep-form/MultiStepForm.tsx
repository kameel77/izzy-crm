import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "use-debounce";
import {
  getApplicationForm,
  heartbeatApplicationForm,
  saveApplicationFormProgress,
  submitApplicationForm,
} from "../../api/application-forms";
import { FormNavigator } from "./FormNavigator";
import { ProgressBar } from "./ProgressBar";
import { Step1_PersonalData, Step1Ref } from "./steps/Step1_PersonalData";
import { Step2_IdentityDocument, Step2Ref } from "./steps/Step2_IdentityDocument";
import { Step3_Addresses, Step3Ref } from "./steps/Step3_Addresses";
import { Step4_Employment, Step4Ref } from "./steps/Step4_Employment";
import { Step5_Budget, Step5Ref } from "./steps/Step5_Budget";
import { Step6_Summary, Step6Ref } from "./steps/Step6_Summary";

const TOTAL_STEPS = 6;

type StepRef = Step1Ref | Step2Ref | Step3Ref | Step4Ref | Step5Ref | Step6Ref;

const AutoSaveStatus: React.FC<{ status: string }> = ({ status }) => (
  <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.875rem', height: '20px' }}>
    {status === 'saving' && 'Zapisywanie...'}
    {status === 'saved' && 'Zapisano.'}
    {status === 'error' && 'Błąd zapisu.'}
  </div>
);

export const MultiStepForm: React.FC = () => {
  const { applicationFormId } = useParams<{ applicationFormId: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [isLoading, setIsLoading] = useState(true);
  const isSavingRef = useRef(false);

  const [debouncedFormData] = useDebounce(formData, 3000);

  const stepRefs = useRef<Array<React.RefObject<StepRef>>>(
    Array.from({ length: TOTAL_STEPS }, () => React.createRef<StepRef>())
  );

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
        if (savedForm && savedForm.status) {
          setFormStatus(savedForm.status);
        }
        if (savedForm && savedForm.submittedAt) {
          setSubmittedAt(savedForm.submittedAt);
        }
        if (savedForm) {
          if (savedForm.status === 'SUBMITTED') {
            setCurrentStep(TOTAL_STEPS);
          } else if (savedForm.currentStep) {
            setCurrentStep(savedForm.currentStep);
          }
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
    if (isLoading || !applicationFormId || formStatus === 'SUBMITTED' || formStatus === 'LOCKED') {
      return;
    }

    const pingHeartbeat = async () => {
      try {
        await heartbeatApplicationForm(applicationFormId);
      } catch (error) {
        console.error("Heartbeat failed", error);
      }
    };

    pingHeartbeat();
    const interval = window.setInterval(pingHeartbeat, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [applicationFormId, formStatus, isLoading]);

  useEffect(() => {
    const performSave = async () => {
      // Do not autosave when the form is submitted or locked
      if (
        isLoading ||
        isSavingRef.current ||
        !applicationFormId ||
        Object.keys(debouncedFormData).length === 0 ||
        formStatus === 'SUBMITTED' ||
        formStatus === 'LOCKED'
      ) {
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
  }, [debouncedFormData, currentStep, applicationFormId, isLoading, formStatus]);

  const handleNext = async () => {
    const currentStepRef = stepRefs.current[currentStep - 1]?.current;
    if (currentStepRef) {
      const isValid = await currentStepRef.triggerValidation();
      if (isValid && currentStep < TOTAL_STEPS) {
        setSubmitAttempted(false);
        setCurrentStep(currentStep + 1);
      } else {
        setSubmitAttempted(true);
      }
    }
  };

  const handleBack = () => {
    setSubmitAttempted(false);
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFormChange = useCallback((newData: object) => {
    setFormData((prev) => ({ ...prev, ...newData }));
    setSaveStatus('idle');
  }, []);

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    const validationPromises = stepRefs.current.map(
      (ref) => ref.current?.triggerValidation() ?? Promise.resolve(false)
    );
    const validationResults = await Promise.all(validationPromises);
    const areAllStepsValid = validationResults.every((isValid) => isValid);

    if (areAllStepsValid) {
      if (!applicationFormId) {
        alert("Błąd: Brak ID formularza.");
        return;
      }
      try {
        await submitApplicationForm(applicationFormId, formData);
        const ts = new Date().toISOString();
        setFormStatus('SUBMITTED');
        setSubmittedAt(ts);
        console.log("Form submitted successfully:", formData);
        navigate('/thank-you');
      } catch (error) {
        console.error("Failed to submit form", error);
        alert("Wystąpił błąd podczas wysyłania formularza. Proszę spróbować ponownie.");
      }
    } else {
      const firstInvalidStep = validationResults.findIndex(isValid => !isValid) + 1;
      console.log(`Validation failed. First invalid step: ${firstInvalidStep}`);
      alert("Proszę uzupełnić wszystkie wymagane pola i zgody.");
      if (firstInvalidStep > 0) {
        setCurrentStep(firstInvalidStep);
      }
    }
  };

  if (isLoading) {
    return <div>Ładowanie...</div>;
  }

  const isReadOnly = formStatus === 'SUBMITTED' || formStatus === 'LOCKED';

  const steps = [
    <Step1_PersonalData key="step-1" ref={stepRefs.current[0] as React.Ref<Step1Ref>} onFormChange={handleFormChange} formData={formData} isReadOnly={isReadOnly} />,
    <Step2_IdentityDocument key="step-2" ref={stepRefs.current[1] as React.Ref<Step2Ref>} onFormChange={handleFormChange} formData={formData} isReadOnly={isReadOnly} />,
    <Step3_Addresses key="step-3" ref={stepRefs.current[2] as React.Ref<Step3Ref>} onFormChange={handleFormChange} formData={formData} isReadOnly={isReadOnly} />,
    <Step4_Employment key="step-4" ref={stepRefs.current[3] as React.Ref<Step4Ref>} onFormChange={handleFormChange} formData={formData} isReadOnly={isReadOnly} />,
    <Step5_Budget key="step-5" ref={stepRefs.current[4] as React.Ref<Step5Ref>} onFormChange={handleFormChange} formData={formData} isReadOnly={isReadOnly} />,
    <Step6_Summary
      key="step-6"
      ref={stepRefs.current[5] as React.Ref<Step6Ref>}
      formData={formData}
      submitAttempted={submitAttempted}
      onFormChange={handleFormChange}
      submittedAt={submittedAt}
      isReadOnly={isReadOnly}
    />
  ];

  return (
    <div>
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
      <AutoSaveStatus status={saveStatus} />
      
      <div style={{ minHeight: "300px", padding: "1rem 0" }}>
        {steps.map((step, index) => (
          <div key={index} style={{ display: currentStep === index + 1 ? 'block' : 'none' }}>
            {step}
          </div>
        ))}
      </div>

      <FormNavigator
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isSubmittable={currentStep === TOTAL_STEPS && !isReadOnly}
      />
    </div>
  );
};
