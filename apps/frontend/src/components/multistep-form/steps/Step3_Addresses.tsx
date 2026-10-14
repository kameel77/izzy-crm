import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DatePicker from "react-datepicker";
import { pl } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Controller } from "react-hook-form";
import { parse, format } from "date-fns";
import { DateMaskInput } from "../../ui/DateMaskInput";
import { Checkbox, TextField } from "../../ui";

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
    control,
    watch,
    trigger,
    setValue,
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
  const isResidentialSame = watch("isResidentialSameAsRegistered");
  const regStreet = watch("registeredStreet");
  const regPostal = watch("registeredPostalCode");
  const regCity = watch("registeredCity");
  const regPostOffice = watch("registeredPostOffice");

  const lastEmittedSnapshotRef = useRef<string>(JSON.stringify(watchedData ?? {}));
  useEffect(() => {
    const current = JSON.stringify(watchedData ?? {});
    if (current !== lastEmittedSnapshotRef.current) {
      lastEmittedSnapshotRef.current = current;
      onFormChange(watchedData);
    }
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
      <fieldset disabled={isReadOnly} className="app-client-fieldset">
      <h2 className="app-client-step-title">Krok 3: Adresy</h2>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Adres zameldowania</legend>
        <div className="form-grid">
          <TextField id="registeredStreet" label="Ulica, nr budynku/mieszkania" {...register("registeredStreet")} error={errors.registeredStreet?.message} />
          <TextField id="registeredPostalCode" label="Kod pocztowy" {...register("registeredPostalCode")} error={errors.registeredPostalCode?.message} />
          <TextField id="registeredCity" label="Miejscowość" {...register("registeredCity")} error={errors.registeredCity?.message} />
          <TextField id="registeredPostOffice" label="Poczta" {...register("registeredPostOffice")} error={errors.registeredPostOffice?.message} />
        </div>
      </fieldset>

      <fieldset className="app-client-section">
        <legend className="app-client-section__title">Adres zamieszkania (korespondencyjny)</legend>
        <div className="app-client-row">
          <Checkbox label="Adres zamieszkania taki sam jak zameldowania" {...register("isResidentialSameAsRegistered")} />
        </div>

        <div className="form-grid">
          <TextField id="residentialCountry" label="Kraj zamieszkania" {...register("residentialCountry")} />
          <TextField id="residentialStreet" label="Ulica, nr budynku/mieszkania" {...register("residentialStreet")} />
          <TextField id="residentialPostalCode" label="Kod pocztowy" {...register("residentialPostalCode")} />
          <TextField id="residentialCity" label="Miejscowość" {...register("residentialCity")} />
          <TextField id="residentialPostOffice" label="Poczta" {...register("residentialPostOffice")} />
          <TextField id="propertyType" label="Typ lokalu" {...register("propertyType")} />
          <TextField id="ownershipType" label="Rodzaj własności" {...register("ownershipType")} />
          <div className="iz-field">
            <label className="iz-field__label" htmlFor="addressFrom">Adres od (RRRR-MM)</label>
            <div className="iz-field__control">
              <Controller
                control={control}
                name="addressFrom"
                render={({ field }) => (
                  <DatePicker
                    id="addressFrom"
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
          </div>
        </div>
      </fieldset>
      </fieldset>
    </form>
  );
});

Step3_Addresses.displayName = "Step3_Addresses";
