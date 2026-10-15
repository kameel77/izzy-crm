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
import { Icon, Select, TextField } from "../../ui";
import { cx } from "../../ui/cx";

const schema = z.object({
  documentType: z.string().min(1, "Rodzaj dokumentu jest wymagany"),
  documentNumber: z.string().min(1, "Numer dokumentu jest wymagany"),
  issueDate: z.string().min(1, "Data wydania jest wymagana"),
  expiryDate: z.string().min(1, "Data ważności jest wymagana"),
  education: z.string().min(1, "Wykształcenie jest wymagane"),
});

type FormValues = z.infer<typeof schema>;

interface Step2Props {
  onFormChange: (data: Partial<FormValues>) => void;
  formData: Partial<FormValues>;
  isReadOnly?: boolean;
}

export interface Step2Ref {
  triggerValidation: () => Promise<boolean>;
}

export const Step2_IdentityDocument = forwardRef<Step2Ref, Step2Props>(({ onFormChange, formData, isReadOnly = false }, ref) => {
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

  const watchedData = watch();

  const lastEmittedSnapshotRef = useRef<string>(JSON.stringify(watchedData ?? {}));
  useEffect(() => {
    const current = JSON.stringify(watchedData ?? {});
    if (current !== lastEmittedSnapshotRef.current) {
      lastEmittedSnapshotRef.current = current;
      onFormChange(watchedData);
    }
  }, [watchedData, onFormChange]);

  useImperativeHandle(ref, () => ({
    triggerValidation: async () => {
      return await trigger();
    },
  }));

  return (
    <form>
      <fieldset disabled={isReadOnly} className="app-client-fieldset">
      <h2 className="app-client-step-title">Krok 2: Dokument tożsamości</h2>
      <div className="form-grid">
        <Select
          id="documentType"
          label="Rodzaj dokumentu"
          {...register("documentType")}
          error={errors.documentType?.message}
          options={[
            { value: "", label: "Wybierz..." },
            { value: "id_card", label: "Dowód osobisty" },
            { value: "passport", label: "Paszport" },
          ]}
        />
        <TextField id="documentNumber" label="Numer dokumentu" {...register("documentNumber")} error={errors.documentNumber?.message} />
        <div className={cx("iz-field", errors.issueDate && "iz-field--error")}>
          <label className="iz-field__label" htmlFor="issueDate">Data wydania</label>
          <div className="iz-field__control">
            <Controller
              control={control}
              name="issueDate"
              render={({ field }) => (
                <DatePicker
                  id="issueDate"
                  locale={pl}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="RRRR-MM-DD"
                  selected={field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                  disabled={isReadOnly}
                  showYearDropdown
                  dropdownMode="select"
                  showMonthDropdown
                  yearDropdownItemNumber={100}
                  scrollableYearDropdown
                  customInput={<DateMaskInput />}
                  className="date-picker-input"
                  wrapperClassName="date-picker-wrapper"
                />
              )}
            />
          </div>
          {errors.issueDate && (
            <div className="iz-field__hint">
              <Icon name="alert" size={12} />
              {errors.issueDate.message}
            </div>
          )}
        </div>
        <div className={cx("iz-field", errors.expiryDate && "iz-field--error")}>
          <label className="iz-field__label" htmlFor="expiryDate">Data ważności</label>
          <div className="iz-field__control">
            <Controller
              control={control}
              name="expiryDate"
              render={({ field }) => (
                <DatePicker
                  id="expiryDate"
                  locale={pl}
                  dateFormat="yyyy-MM-dd"
                  placeholderText="RRRR-MM-DD"
                  selected={field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                  disabled={isReadOnly}
                  showYearDropdown
                  dropdownMode="select"
                  showMonthDropdown
                  yearDropdownItemNumber={100}
                  scrollableYearDropdown
                  customInput={<DateMaskInput />}
                  className="date-picker-input"
                  wrapperClassName="date-picker-wrapper"
                />
              )}
            />
          </div>
          {errors.expiryDate && (
            <div className="iz-field__hint">
              <Icon name="alert" size={12} />
              {errors.expiryDate.message}
            </div>
          )}
        </div>
        <Select
          id="education"
          label="Wykształcenie"
          {...register("education")}
          error={errors.education?.message}
          options={[
            { value: "", label: "Wybierz..." },
            { value: "primary", label: "Podstawowe" },
            { value: "secondary", label: "Średnie" },
            { value: "higher", label: "Wyższe" },
            { value: "postgraduate", label: "Podyplomowe" },
          ]}
        />
      </div>
      </fieldset>
    </form>
  );
});

Step2_IdentityDocument.displayName = "Step2_IdentityDocument";
