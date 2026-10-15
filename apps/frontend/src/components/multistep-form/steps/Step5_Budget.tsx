import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { TextField } from "../../ui";

const schema = z.object({
  mainIncome: z.coerce.number().min(1, "Główne dochody są wymagane"),
  otherIncome: z.coerce.number().optional(),
  housingFees: z.coerce.number().min(0, "Wartość nie może być ujemna"),
  otherLivingCosts: z.coerce.number().min(0, "Wartość nie może być ujemna"),
  loanInstallments: z.coerce.number().min(0, "Wartość nie może być ujemna"),
  cardLimits: z.coerce.number().min(0, "Wartość nie może być ujemna"),
  otherFinancialLiabilities: z.coerce.number().min(0, "Wartość nie może być ujemna"),
});

type FormValues = z.infer<typeof schema>;

interface Step5Props {
  onFormChange: (data: Partial<FormValues>) => void;
  formData: Partial<FormValues>;
  isReadOnly?: boolean;
}

export interface Step5Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step5_Budget = forwardRef<Step5Ref, Step5Props>(({ onFormChange, formData, isReadOnly = false }, ref) => {
  const {
    register,
    watch,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData,
    mode: "onBlur",
  });

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      return await trigger();
    },
  }));

  const watchedData = watch();
  
  const lastEmittedSnapshotRef = useRef<string>(JSON.stringify(watchedData ?? {}));
  useEffect(() => {
    const current = JSON.stringify(watchedData ?? {});
    if (current !== lastEmittedSnapshotRef.current) {
      lastEmittedSnapshotRef.current = current;
      onFormChange(watchedData);
    }
  }, [watchedData, onFormChange]);

  const safeParse = (value: unknown) => parseFloat(String(value)) || 0;

  const totalIncome =
    safeParse(watchedData.mainIncome) + safeParse(watchedData.otherIncome);
  const totalExpenses =
    safeParse(watchedData.housingFees) +
    safeParse(watchedData.otherLivingCosts) +
    safeParse(watchedData.loanInstallments) +
    safeParse(watchedData.cardLimits) +
    safeParse(watchedData.otherFinancialLiabilities);
  const creditAbility = totalIncome - totalExpenses;

  return (
    <form>
      <fieldset disabled={isReadOnly} className="app-client-fieldset">
      <h2 className="app-client-step-title">Krok 5: Budżet</h2>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Dochody (PLN)</legend>
        <div className="form-grid">
          <TextField id="mainIncome" label="Główne dochody (netto)" type="number" {...register("mainIncome")} error={errors.mainIncome?.message} />
          <TextField id="otherIncome" label="Inne dochody (opcjonalnie)" type="number" {...register("otherIncome")} />
        </div>
      </fieldset>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Wydatki (PLN)</legend>
        <div className="form-grid">
          <TextField id="housingFees" label="Opłaty za mieszkanie" type="number" {...register("housingFees")} error={errors.housingFees?.message} />
          <TextField id="otherLivingCosts" label="Pozostałe koszty życia" type="number" {...register("otherLivingCosts")} error={errors.otherLivingCosts?.message} />
          <TextField id="loanInstallments" label="Kwota rat kredytów" type="number" {...register("loanInstallments")} error={errors.loanInstallments?.message} />
          <TextField id="cardLimits" label="Kwota limitów kart/kredytów" type="number" {...register("cardLimits")} error={errors.cardLimits?.message} />
          <TextField id="otherFinancialLiabilities" label="Inne obciążenia finansowe" type="number" {...register("otherFinancialLiabilities")} error={errors.otherFinancialLiabilities?.message} />
        </div>
      </fieldset>

      <div className="app-panel app-client-budget">
        <p><strong>Dochód netto:</strong> {totalIncome.toFixed(2)} PLN</p>
        <p><strong>Suma wydatków:</strong> {totalExpenses.toFixed(2)} PLN</p>
        <p><strong>Zdolność kredytowa (informacyjnie):</strong> {creditAbility.toFixed(2)} PLN</p>
      </div>
      </fieldset>
    </form>
  );
});

Step5_Budget.displayName = "Step5_Budget";
