import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { validatePESEL } from "../../../utils/pesel";

const phoneRegex = /^(?:\+?48)?(?:[ -]?)?(?:\d[ -]?){9}$/;

const schema = z.object({
  pesel: z.string().length(11, "PESEL musi mieć 11 cyfr"),
  firstName: z.string().min(1, "Imię jest wymagane"),
  lastName: z.string().min(1, "Nazwisko jest wymagane"),
  mobilePhone: z
    .string()
    .min(1, "Numer telefonu jest wymagany")
    .regex(phoneRegex, "Nieprawidłowy format numeru telefonu")
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
}

export interface Step1Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step1_PersonalData = forwardRef<Step1Ref, Step1Props>(({ onFormChange, formData }, ref) => {
  const {
    register,
    watch,
    setValue,
    trigger,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData,
    mode: "onBlur",
  });

  // Reset only when incoming formData truly differs from last applied snapshot
  const lastResetSnapshotRef = useRef<string>(JSON.stringify(formData ?? {}));
  useEffect(() => {
    const incoming = JSON.stringify(formData ?? {});
    if (incoming !== lastResetSnapshotRef.current) {
      reset(formData);
      lastResetSnapshotRef.current = incoming;
    }
  }, [formData, reset]);

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      return await trigger();
    },
  }));

  const watchedData = watch();
  const peselValue = watch("pesel");
  const watchedPhone = watch("mobilePhone");

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
        setValue("birthDate", validationResult.birthDate.toISOString().split("T")[0]);
        setValue("gender", validationResult.gender);
      }
    }
  }, [peselValue, setValue]);

  useEffect(() => {
    const phone = watchedPhone?.replace(/[\s-]+/g, "");
    if (phone && phone.length >= 9) {
      const digitsOnly = phone.replace(/\D/g, "").slice(-9);
      const formatted = `+48 ${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6, 9)}`;
      if (formatted !== watchedPhone) {
        setValue("mobilePhone", formatted, { shouldValidate: true });
      }
    }
  }, [watchedPhone, setValue]);

  return (
    <form>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 1: Dane osobowe</h2>
      <div style={styles.grid}>
        {/* Row 1 */}
        <div style={styles.field}>
          <label htmlFor="pesel">PESEL</label>
          <input id="pesel" {...register("pesel")} />
          {errors.pesel && <span style={styles.error}>{errors.pesel.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="gender">Płeć</label>
          <input id="gender" {...register("gender")} disabled />
          {errors.gender && <span style={styles.error}>{errors.gender.message}</span>}
        </div>

        {/* Row 2 */}
        <div style={styles.field}>
          <label htmlFor="firstName">Imię</label>
          <input id="firstName" {...register("firstName")} />
          {errors.firstName && <span style={styles.error}>{errors.firstName.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="lastName">Nazwisko</label>
          <input id="lastName" {...register("lastName")} />
          {errors.lastName && <span style={styles.error}>{errors.lastName.message}</span>}
        </div>

        {/* Row 3 */}
        <div style={styles.field}>
          <label htmlFor="mobilePhone">Telefon komórkowy</label>
          <input id="mobilePhone" {...register("mobilePhone")} />
          {errors.mobilePhone && <span style={styles.error}>{errors.mobilePhone.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="email">E-mail</label>
          <input id="email" {...register("email")} />
          {errors.email && <span style={styles.error}>{errors.email.message}</span>}
        </div>
        
        {/* Row 4 */}
        <div style={styles.field}>
          <label htmlFor="birthDate">Data urodzenia</label>
          <input id="birthDate" {...register("birthDate")} disabled />
          {errors.birthDate && <span style={styles.error}>{errors.birthDate.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="birthPlace">Miejsce urodzenia</label>
          <input id="birthPlace" {...register("birthPlace")} />
          {errors.birthPlace && <span style={styles.error}>{errors.birthPlace.message}</span>}
        </div>

        {/* Row 5 */}
        <div style={styles.field}>
          <label htmlFor="countryOfBirth">Kraj urodzenia</label>
          <input id="countryOfBirth" {...register("countryOfBirth")} />
          {errors.countryOfBirth && <span style={styles.error}>{errors.countryOfBirth.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="nationality">Narodowość</label>
          <input id="nationality" {...register("nationality")} />
          {errors.nationality && <span style={styles.error}>{errors.nationality.message}</span>}
        </div>

        {/* Row 6 */}
        <div style={styles.field}>
          <label htmlFor="citizenship">Obywatelstwo</label>
          <input id="citizenship" {...register("citizenship")} />
          {errors.citizenship && <span style={styles.error}>{errors.citizenship.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="secondCitizenship">Drugie obywatelstwo (opcjonalnie)</label>
          <input id="secondCitizenship" {...register("secondCitizenship")} />
        </div>

        {/* Row 7 */}
        <div style={styles.field}>
          <label htmlFor="maidenName">Nazwisko rodowe</label>
          <input id="maidenName" {...register("maidenName")} />
          {errors.maidenName && <span style={styles.error}>{errors.maidenName.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="mothersMaidenName">Nazwisko panieńskie matki</label>
          <input id="mothersMaidenName" {...register("mothersMaidenName")} />
          {errors.mothersMaidenName && <span style={styles.error}>{errors.mothersMaidenName.message}</span>}
        </div>

        {/* Row 8 */}
        <div style={styles.field}>
          <label htmlFor="maritalStatus">Stan cywilny</label>
          <select id="maritalStatus" {...register("maritalStatus")}>
            <option value="">Wybierz...</option>
            <option value="single">Panna / Kawaler</option>
            <option value="married">Żonaty / Mężatka</option>
            <option value="divorced">Rozwiedziony / Rozwiedziona</option>
            <option value="widowed">Wdowiec / Wdowa</option>
          </select>
          {errors.maritalStatus && <span style={styles.error}>{errors.maritalStatus.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="childrenCount">Liczba dzieci</label>
          <input id="childrenCount" type="number" min="0" {...register("childrenCount")} />
          {errors.childrenCount && <span style={styles.error}>{errors.childrenCount.message}</span>}
        </div>

        {/* Row 9 */}
        <div style={styles.field}>
          <label>
            <input type="checkbox" {...register("isTaxResident")} />
            Jestem rezydentem podatkowym
          </label>
        </div>
      </div>
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
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
  },
};
