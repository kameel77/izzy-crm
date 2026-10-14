import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import DatePicker from "react-datepicker";
import { pl } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Controller } from "react-hook-form";
import { parse, format } from "date-fns";
import { DateMaskInput } from "../../ui/DateMaskInput";
import { Icon, TextField } from "../../ui";
import { cx } from "../../ui/cx";

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
  isReadOnly?: boolean;
}

export interface Step4Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step4_Employment = forwardRef<Step4Ref, Step4Props>(({ onFormChange, formData, isReadOnly = false }, ref) => {
  const {
    register,
    control,
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

  return (
    <form>
      <fieldset disabled={isReadOnly} className="app-client-fieldset">
      <h2 className="app-client-step-title">Krok 4: Zatrudnienie</h2>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Informacje o zatrudnieniu</legend>
        <div className="form-grid">
          <TextField id="incomeSource" label="Źródło dochodów" {...register("incomeSource")} error={errors.incomeSource?.message} />
          <div className={cx("iz-field", errors.employmentSince && "iz-field--error")}>
            <label className="iz-field__label" htmlFor="employmentSince">Zatrudnienie od (RRRR-MM)</label>
            <div className="iz-field__control">
              <Controller
                control={control}
                name="employmentSince"
                render={({ field }) => (
                  <DatePicker
                    id="employmentSince"
                    locale={pl}
                    dateFormat="yyyy-MM"
                    showMonthYearPicker
                    placeholderText="RRRR-MM"
                    selected={field.value ? parse(field.value, "yyyy-MM", new Date()) : null}
                    onChange={(date: Date | null) => field.onChange(date ? format(date, "yyyy-MM") : "")}
                    disabled={isReadOnly}
                    showYearDropdown
                    dropdownMode="select"
                    yearDropdownItemNumber={100}
                    scrollableYearDropdown
                    customInput={<DateMaskInput maskFormat="YYYY-MM" />}
                    className="date-picker-input"
                    wrapperClassName="date-picker-wrapper"
                  />
                )}
              />
            </div>
            {errors.employmentSince && (
              <div className="iz-field__hint">
                <Icon name="alert" size={12} />
                {errors.employmentSince.message}
              </div>
            )}
          </div>
          <TextField id="profession" label="Zawód" {...register("profession")} error={errors.profession?.message} />
          <TextField id="position" label="Stanowisko" {...register("position")} error={errors.position?.message} />
          <TextField id="employmentSector" label="Sektor zatrudnienia" {...register("employmentSector")} error={errors.employmentSector?.message} />
          <TextField id="totalWorkExperience" label="Całkowity staż pracy" {...register("totalWorkExperience")} error={errors.totalWorkExperience?.message} />
          <TextField id="workplaceType" label="Rodzaj zakładu pracy" {...register("workplaceType")} error={errors.workplaceType?.message} />
        </div>
      </fieldset>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Dane pracodawcy</legend>
        <div className="form-grid">
          <TextField id="employerName" label="Nazwa" {...register("employerName")} error={errors.employerName?.message} />
          <TextField id="employerPhone" label="Telefon" {...register("employerPhone")} error={errors.employerPhone?.message} />
          <TextField id="employerStreet" label="Ulica, nr budynku/mieszkania" {...register("employerStreet")} error={errors.employerStreet?.message} />
          <TextField id="employerPostalCode" label="Kod pocztowy" {...register("employerPostalCode")} error={errors.employerPostalCode?.message} />
          <TextField id="employerCity" label="Miejscowość" {...register("employerCity")} error={errors.employerCity?.message} />
          <TextField id="employerPostOffice" label="Poczta" {...register("employerPostOffice")} error={errors.employerPostOffice?.message} />
          <TextField id="employerNip" label="NIP (opcjonalnie)" {...register("employerNip")} />
          <TextField id="employerRegon" label="REGON (opcjonalnie)" {...register("employerRegon")} />
        </div>
      </fieldset>
      </fieldset>
    </form>
  );
});

Step4_Employment.displayName = "Step4_Employment";
