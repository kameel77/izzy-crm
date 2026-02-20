import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const schema = z.object({
  registeredStreet: z.string().min(1, "Ulica jest wymagana"),
  registeredPostalCode: z.string().regex(/^\d{2}-\d{3}$/, "Nieprawidłowy kod pocztowy"),
  registeredCity: z.string().min(1, "Miejscowość jest wymagana"),
  registeredPostOffice: z.string().min(1, "Poczta jest wymagana"),
  isResidentialSameAsRegistered: z.boolean(),
  residentialCountry: z.string().optional(),
  residentialStreet: z.string().optional(),
  residentialPostalCode: z.string().optional(),
  residentialCity: z.string().optional(),
  residentialPostOffice: z.string().optional(),
  propertyType: z.string().optional(),
  ownershipType: z.string().optional(),
  addressFrom: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Step3Props {
  onFormChange: (data: Partial<FormValues>) => void;
  formData: Partial<FormValues>;
  isReadOnly?: boolean;
}

export interface Step3Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step3_Addresses = forwardRef<Step3Ref, Step3Props>(({ onFormChange, formData, isReadOnly = false }, ref) => {
  const {
    register,
    watch,
    trigger,
    reset,
    setValue,
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
  const isResidentialSame = watch("isResidentialSameAsRegistered");
  const regStreet = watch("registeredStreet");
  const regPostal = watch("registeredPostalCode");
  const regCity = watch("registeredCity");
  const regPostOffice = watch("registeredPostOffice");

  useEffect(() => {
    onFormChange(watchedData);
  }, [watchedData, onFormChange]);

  // Copy on toggle only: when checked -> copy; when unchecked -> clear residential fields
  const prevIsSameRef = useRef<boolean | undefined>(isResidentialSame);
  useEffect(() => {
    const prev = prevIsSameRef.current;
    if (prev !== isResidentialSame) {
      if (isResidentialSame) {
        const copy = (field: keyof FormValues, value?: string | null) => {
          setValue(field, (value ?? "") as FormValues[keyof FormValues], { shouldValidate: true });
        };
        copy("residentialStreet", regStreet);
        copy("residentialPostalCode", regPostal);
        copy("residentialCity", regCity);
        copy("residentialPostOffice", regPostOffice);
      } else {
        const clear = (field: keyof FormValues) => {
          setValue(field, "" as FormValues[keyof FormValues], { shouldValidate: true });
        };
        clear("residentialStreet");
        clear("residentialPostalCode");
        clear("residentialCity");
        clear("residentialPostOffice");
      }
      prevIsSameRef.current = isResidentialSame;
    }
  }, [isResidentialSame, regStreet, regPostal, regCity, regPostOffice, setValue]);

  return (
    <form>
      <fieldset disabled={isReadOnly} style={styles.readOnlyFieldset}>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 3: Adresy</h2>
      
      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Adres zameldowania</legend>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label htmlFor="registeredStreet">Ulica, nr budynku/mieszkania</label>
            <input id="registeredStreet" {...register("registeredStreet")} />
            {errors.registeredStreet && <span style={styles.error}>{errors.registeredStreet.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="registeredPostalCode">Kod pocztowy</label>
            <input id="registeredPostalCode" {...register("registeredPostalCode")} />
            {errors.registeredPostalCode && <span style={styles.error}>{errors.registeredPostalCode.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="registeredCity">Miejscowość</label>
            <input id="registeredCity" {...register("registeredCity")} />
            {errors.registeredCity && <span style={styles.error}>{errors.registeredCity.message}</span>}
          </div>
          <div style={styles.field}>
            <label htmlFor="registeredPostOffice">Poczta</label>
            <input id="registeredPostOffice" {...register("registeredPostOffice")} />
            {errors.registeredPostOffice && <span style={styles.error}>{errors.registeredPostOffice.message}</span>}
          </div>
        </div>
      </fieldset>

      <fieldset style={styles.fieldset}>
        <legend style={styles.legend}>Adres zamieszkania (korespondencyjny)</legend>
        <div style={{...styles.field, marginBottom: '1rem'}}>
          <label>
            <input type="checkbox" {...register("isResidentialSameAsRegistered")} />
            Adres zamieszkania taki sam jak zameldowania
          </label>
        </div>

        <div style={styles.grid}>
          <div style={styles.field}>
            <label htmlFor="residentialCountry">Kraj zamieszkania</label>
            <input id="residentialCountry" {...register("residentialCountry")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="residentialStreet">Ulica, nr budynku/mieszkania</label>
            <input id="residentialStreet" {...register("residentialStreet")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="residentialPostalCode">Kod pocztowy</label>
            <input id="residentialPostalCode" {...register("residentialPostalCode")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="residentialCity">Miejscowość</label>
            <input id="residentialCity" {...register("residentialCity")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="residentialPostOffice">Poczta</label>
            <input id="residentialPostOffice" {...register("residentialPostOffice")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="propertyType">Typ lokalu</label>
            <input id="propertyType" {...register("propertyType")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="ownershipType">Rodzaj własności</label>
            <input id="ownershipType" {...register("ownershipType")} />
          </div>
          <div style={styles.field}>
            <label htmlFor="addressFrom">Adres od (RRRR-MM)</label>
            <input id="addressFrom" type="month" {...register("addressFrom")} />
          </div>
        </div>
      </fieldset>
      </fieldset>
    </form>
  );
});

Step3_Addresses.displayName = "Step3_Addresses";

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
  readOnlyFieldset: {
    border: "none",
    padding: 0,
    margin: 0,
  },
};