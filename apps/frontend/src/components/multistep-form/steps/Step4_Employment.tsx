import React, { useEffect, useImperativeHandle, forwardRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  incomeSource: z.string().min(1, "Źródło dochodów jest wymagane"),
  employmentSince: z.string().min(1, "Data zatrudnienia jest wymagana"),
  profession: z.string().min(1, "Zawód jest wymagany"),
  position: z.string().min(1, "Stanowisko jest wymagane"),
  employmentSector: z.string().min(1, "Sektor zatrudnienia jest wymagany"),
  totalWorkExperience: z.string().min(1, "Staż pracy jest wymagany"),
  workplaceType: z.string().min(1, "Rodzaj zakładu pracy jest wymagany"),
  employerName: z.string().min(1, "Nazwa pracodawcy jest wymagana"),
  employerStreet: z.string().min(1, "Ulica pracodawcy jest wymagana"),
  employerPostalCode: z.string().regex(/^\d{2}-\d{3}$/, "Nieprawidłowy kod pocztowy"),
  employerCity: z.string().min(1, "Miejscowość pracodawcy jest wymagana"),
  employerPostOffice: z.string().min(1, "Poczta pracodawcy jest wymagana"),
  employerPhone: z.string().min(1, "Telefon do pracodawcy jest wymagany"),
  employerNip: z.string().optional(),
  employerRegon: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Step4Props {
  onFormChange: (data: Partial<FormValues>) => void;
  formData: Partial<FormValues>;
}

export interface Step4Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step4_Employment = forwardRef<Step4Ref, Step4Props>(({ onFormChange, formData }, ref) => {
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
  }, [JSON.stringify(watchedData), onFormChange]);

  return (
    <form>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 4: Zatrudnienie</h2>
      
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Informacje o zatrudnieniu</legend>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label htmlFor="incomeSource">Źródło dochodów</label>
            <input id="incomeSource" {...register("incomeSource")} />
            {errors.incomeSource && <span style={styles.error}>{errors.incomeSource.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employmentSince">Zatrudnienie od (RRRR-MM)</label>
            <input id="employmentSince" type="month" {...register("employmentSince")} />
            {errors.employmentSince && <span style={styles.error}>{errors.employmentSince.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="profession">Zawód</label>
            <input id="profession" {...register("profession")} />
            {errors.profession && <span style={styles.error}>{errors.profession.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="position">Stanowisko</label>
            <input id="position" {...register("position")} />
            {errors.position && <span style={styles.error}>{errors.position.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employmentSector">Sektor zatrudnienia</label>
            <input id="employmentSector" {...register("employmentSector")} />
            {errors.employmentSector && <span style={styles.error}>{errors.employmentSector.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="totalWorkExperience">Całkowity staż pracy</label>
            <input id="totalWorkExperience" {...register("totalWorkExperience")} />
            {errors.totalWorkExperience && <span style={styles.error}>{errors.totalWorkExperience.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="workplaceType">Rodzaj zakładu pracy</label>
            <input id="workplaceType" {...register("workplaceType")} />
            {errors.workplaceType && <span style={styles.error}>{errors.workplaceType.message}</span>}
          </div>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Dane pracodawcy</legend>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label htmlFor="employerName">Nazwa</label>
            <input id="employerName" {...register("employerName")} />
            {errors.employerName && <span style={styles.error}>{errors.employerName.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employerPhone">Telefon</label>
            <input id="employerPhone" {...register("employerPhone")} />
            {errors.employerPhone && <span style={styles.error}>{errors.employerPhone.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employerStreet">Ulica, nr budynku/mieszkania</label>
            <input id="employerStreet" {...register("employerStreet")} />
            {errors.employerStreet && <span style={styles.error}>{errors.employerStreet.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employerPostalCode">Kod pocztowy</label>
            <input id="employerPostalCode" {...register("employerPostalCode")} />
            {errors.employerPostalCode && <span style={styles.error}>{errors.employerPostalCode.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employerCity">Miejscowość</label>
            <input id="employerCity" {...register("employerCity")} />
            {errors.employerCity && <span style={styles.error}>{errors.employerCity.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employerPostOffice">Poczta</label>
            <input id="employerPostOffice" {...register("employerPostOffice")} />
            {errors.employerPostOffice && <span style={styles.error}>{errors.employerPostOffice.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="employerNip">NIP (opcjonalnie)</label>
            <input id="employerNip" {...register("employerNip")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="employerRegon">REGON (opcjonalnie)</label>
            <input id="employerRegon" {...register("employerRegon")} />
          </div>
        </div>
      </fieldset>
    </form>
  );
});

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
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
  },
};