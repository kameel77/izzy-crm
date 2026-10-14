import React, { useState } from "react";
import { MultiStepForm } from "../components/multistep-form/MultiStepForm";

export const ApplicationFormPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="app-client">
      <header className="app-client__header">
        {currentStep === 1 ? (
          <>
            <h1 className="app-client__title">Wniosek o finansowanie</h1>
            <p className="app-client__desc">
              Wypełnij poniższy formularz, aby złożyć wniosek. Możesz zapisać postęp i wrócić w dowolnym momencie.
            </p>
          </>
        ) : (
          <h1 className="app-client__title app-client__title--compact">Wniosek o finansowanie</h1>
        )}
      </header>
      <main className="form-main-card">
        <MultiStepForm onStepChange={setCurrentStep} />
      </main>
    </div>
  );
};
