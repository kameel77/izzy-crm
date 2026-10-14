import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { validatePESEL } from "../../../utils/pesel";
import DatePicker from "react-datepicker";
import { pl } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Controller } from "react-hook-form";
import { parse, format } from "date-fns";
import { Checkbox, Icon, Select, TextField } from "../../ui";
import { cx } from "../../ui/cx";

const phoneRegex = /^\+?[0-9\s-]{9,15}$/;

const schema = z.object({
  pesel: z.string().length(11, "PESEL musi mieć 11 cyfr"),
  firstName: z.string().min(1, "Imię jest wymagane"),
  lastName: z.string().min(1, "Nazwisko jest wymagane"),
  mobilePhone: z
    .string()
    .min(1, "Numer telefonu jest wymagany")
    .regex(phoneRegex, "Wpisz poprawny numer telefonu (np. +48 123 456 789 lub 123456789)")
    .transform(val => val.replace(/[\s-]+/g, "")),
  email: z.string().email("Nieprawidłowy format email"),
  birthDate: z.string().min(1, "Data urodzenia jest wymagana"),
  gender: z.string().min(1, "Płeć jest wymagana"),
  birthPlace: z.string().min(1, "Miejsce urodzenia jest wymagane"),
  countryOfBirth: z.string().min(1, "Kraj urodzenia jest wymagany"),
  citizenship: z.string().min(1, "Obywatelstwo jest wymagane"),
  secondCitizenship: z.string().optional(),
  nationality: z.string().min(1, "Narodowość jest wymagana"),
  maidenName: z.string().min(1, "Nazwisko rodowe jest wymagane"),
  maritalStatus: z.string().min(1, "Stan cywilny jest wymagany"),
  mothersMaidenName: z.string().min(1, "Nazwisko panieńskie matki jest wymagane"),
  isTaxResident: z.boolean().optional(),
  childrenCount: z.coerce.number().min(0, "Liczba dzieci nie może być ujemna").optional(),
}).refine(data => validatePESEL(data.pesel).valid, {
  message: "Nieprawidłowy numer PESEL",
  path: ["pesel"],
});

type FormValues = z.infer<typeof schema>;

interface Step1Props {
  onFormChange: (data: Partial<FormValues>) => void;
  formData: Partial<FormValues>;
  isReadOnly?: boolean;
}

export interface Step1Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step1_PersonalData = forwardRef<Step1Ref, Step1Props>(({ onFormChange, formData, isReadOnly = false }, ref) => {
  const {
    register,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData,
    mode: "onBlur",
  });

  // Initial data loading is handled by the `defaultValues` prop in useForm.
  // We explicitly AVOID calling reset(formData) when incoming formData changes 
  // because formData is updated on every field change in parent component logic,
  // which would trigger an endless loop and cursor reset issues.

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      return await trigger();
    },
  }));

  const watchedData = watch();
  const peselValue = watch("pesel");


  // Emit changes to parent only when values actually changed compared to last emission
  const lastEmittedSnapshotRef = useRef<string>(JSON.stringify(watchedData ?? {}));
  useEffect(() => {
    const current = JSON.stringify(watchedData ?? {});
    if (current !== lastEmittedSnapshotRef.current) {
      lastEmittedSnapshotRef.current = current;
      onFormChange(watchedData);
    }
    // Intentionally depend on watchedData object (RHF watch) to capture real changes
  }, [watchedData, onFormChange]);

  useEffect(() => {
    if (peselValue && peselValue.length === 11) {
      const validationResult = validatePESEL(peselValue);
      if (validationResult.valid && validationResult.birthDate && validationResult.gender) {
        setValue("birthDate", validationResult.birthDate.toISOString().split("T")[0], { shouldValidate: true, shouldDirty: true });
        setValue("gender", validationResult.gender, { shouldValidate: true, shouldDirty: true });
      }
    }
  }, [peselValue, setValue]);


  return (
    <form>
      <fieldset disabled={isReadOnly} className="app-client-fieldset">
      <h2 className="app-client-step-title">Krok 1: Dane osobowe</h2>
      <div className="form-grid">
        {/* Row 1 */}
        <TextField id="pesel" label="PESEL" {...register("pesel")} error={errors.pesel?.message} />
        <TextField id="gender" label="Płeć" disabled {...register("gender")} error={errors.gender?.message} />

        {/* Row 2 */}
        <TextField id="firstName" label="Imię" {...register("firstName")} error={errors.firstName?.message} />
        <TextField id="lastName" label="Nazwisko" {...register("lastName")} error={errors.lastName?.message} />

        {/* Row 3 */}
        <TextField id="mobilePhone" label="Telefon komórkowy" {...register("mobilePhone")} error={errors.mobilePhone?.message} />
        <TextField id="email" label="E-mail" {...register("email")} error={errors.email?.message} />

        {/* Row 4 */}
        <div className={cx("iz-field", errors.birthDate && "iz-field--error", "iz-field--disabled")}>
          <label className="iz-field__label" htmlFor="birthDate">Data urodzenia</label>
          <div className="iz-field__control">
            <Controller
              control={control}
              name="birthDate"
              render={({ field }) => (
                <DatePicker
                  id="birthDate"
                  locale={pl}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="RRRR-MM-DD"
                  selected={field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                  disabled={true}
                  className="date-picker-input-readonly"
                  wrapperClassName="date-picker-wrapper"
                />
              )}
            />
          </div>
          {errors.birthDate && (
            <div className="iz-field__hint">
              <Icon name="alert" size={12} />
              {errors.birthDate.message}
            </div>
          )}
        </div>
        <TextField id="birthPlace" label="Miejsce urodzenia" {...register("birthPlace")} error={errors.birthPlace?.message} />

        {/* Row 5 */}
        <TextField id="countryOfBirth" label="Kraj urodzenia" {...register("countryOfBirth")} error={errors.countryOfBirth?.message} />
        <TextField id="nationality" label="Narodowość" {...register("nationality")} error={errors.nationality?.message} />

        {/* Row 6 */}
        <TextField id="citizenship" label="Obywatelstwo" {...register("citizenship")} error={errors.citizenship?.message} />
        <TextField id="secondCitizenship" label="Drugie obywatelstwo (opcjonalnie)" {...register("secondCitizenship")} />

        {/* Row 7 */}
        <TextField id="maidenName" label="Nazwisko rodowe" {...register("maidenName")} error={errors.maidenName?.message} />
        <TextField id="mothersMaidenName" label="Nazwisko panieńskie matki" {...register("mothersMaidenName")} error={errors.mothersMaidenName?.message} />

        {/* Row 8 */}
        <Select
          id="maritalStatus"
          label="Stan cywilny"
          {...register("maritalStatus")}
          error={errors.maritalStatus?.message}
          options={[
            { value: "", label: "Wybierz..." },
            { value: "single", label: "Panna / Kawaler" },
            { value: "married", label: "Żonaty / Mężatka" },
            { value: "divorced", label: "Rozwiedziony / Rozwiedziona" },
            { value: "widowed", label: "Wdowiec / Wdowa" },
          ]}
        />
        <TextField id="childrenCount" label="Liczba dzieci" type="number" min="0" {...register("childrenCount")} error={errors.childrenCount?.message} />

        {/* Row 9 */}
        <Checkbox label="Jestem rezydentem podatkowym" {...register("isTaxResident")} />
      </div>
      </fieldset>
    </form>
  );
});

Step1_PersonalData.displayName = "Step1_PersonalData";
