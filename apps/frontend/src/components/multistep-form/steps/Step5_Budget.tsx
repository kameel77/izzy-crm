import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData,
    mode: "onBlur",
  });

  useEffect(() => {
    reset(formData);
  }, [formData, reset]);

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      return await trigger();
    },
  }));

  const watchedData = watch();
  useEffect(() => {
    onFormChange(watchedData);
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
      <fieldset disabled={isReadOnly} style={styles.readOnlyFieldset}>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 5: Budżet</h2>
      
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Dochody (PLN)</legend>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label htmlFor="mainIncome">Główne dochody (netto)</label>
            <input id="mainIncome" type="number" {...register("mainIncome")} />
            {errors.mainIncome && <span style={styles.error}>{errors.mainIncome.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="otherIncome">Inne dochody (opcjonalnie)</label>
            <input id="otherIncome" type="number" {...register("otherIncome")} />
          </div>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Wydatki (PLN)</legend>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label htmlFor="housingFees">Opłaty za mieszkanie</label>
            <input id="housingFees" type="number" {...register("housingFees")} />
            {errors.housingFees && <span style={styles.error}>{errors.housingFees.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="otherLivingCosts">Pozostałe koszty życia</label>
            <input id="otherLivingCosts" type="number" {...register("otherLivingCosts")} />
            {errors.otherLivingCosts && <span style={styles.error}>{errors.otherLivingCosts.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="loanInstallments">Kwota rat kredytów</label>
            <input id="loanInstallments" type="number" {...register("loanInstallments")} />
            {errors.loanInstallments && <span style={styles.error}>{errors.loanInstallments.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="cardLimits">Kwota limitów kart/kredytów</label>
            <input id="cardLimits" type="number" {...register("cardLimits")} />
            {errors.cardLimits && <span style={styles.error}>{errors.cardLimits.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="otherFinancialLiabilities">Inne obciążenia finansowe</label>
            <input id="otherFinancialLiabilities" type="number" {...register("otherFinancialLiabilities")} />
            {errors.otherFinancialLiabilities && <span style={styles.error}>{errors.otherFinancialLiabilities.message}</span>}
          </div>
        </div>
      </fieldset>

      <div style={styles.summary}>
        <p><strong>Dochód netto:</strong> {totalIncome.toFixed(2)} PLN</p>
        <p><strong>Suma wydatków:</strong> {totalExpenses.toFixed(2)} PLN</p>
        <p><strong>Zdolność kredytowa (informacyjnie):</strong> {creditAbility.toFixed(2)} PLN</p>
      </div>
      </fieldset>
    </form>
  );
});

Step5_Budget.displayName = "Step5_Budget";

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.5rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  fieldset: {
    border: "none",
    padding: 0,
    margin: "0 0 2rem 0",
  },
  legend: {
    fontWeight: 600,
    fontSize: "1.1rem",
    marginBottom: "1rem",
    padding: 0,
    width: '100%',
    borderBottom: '1px solid #e5e7eb',
  },
  summary: {
    marginTop: "2rem",
    padding: "1rem",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
  },
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
  },
  readOnlyFieldset: {
    border: "none",
    padding: 0,
    margin: 0,
  },
};