import React, { useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import DatePicker from "react-datepicker";
import { pl } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Controller } from "react-hook-form";
import { parse, format } from "date-fns";

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
    reset,
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
      <fieldset disabled={isReadOnly} style={styles.readOnlyFieldset}>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 2: Dokument tożsamości</h2>
      <div className="form-grid">
        <div style={styles.field}>
          <label htmlFor="documentType">Rodzaj dokumentu</label>
          <select id="documentType" {...register("documentType")}>
            <option value="">Wybierz...</option>
            <option value="id_card">Dowód osobisty</option>
            <option value="passport">Paszport</option>
          </select>
          {errors.documentType && <span style={styles.error}>{errors.documentType.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="documentNumber">Numer dokumentu</label>
          <input id="documentNumber" {...register("documentNumber")} />
          {errors.documentNumber && <span style={styles.error}>{errors.documentNumber.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="issueDate">Data wydania</label>
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
                className="date-picker-input native-input"
                wrapperClassName="date-picker-wrapper"
              />
            )}
          />
          {errors.issueDate && <span style={styles.error}>{errors.issueDate.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="expiryDate">Data ważności</label>
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
                className="date-picker-input native-input"
                wrapperClassName="date-picker-wrapper"
              />
            )}
          />
          {errors.expiryDate && <span style={styles.error}>{errors.expiryDate.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="education">Wykształcenie</label>
          <select id="education" {...register("education")}>
            <option value="">Wybierz...</option>
            <option value="primary">Podstawowe</option>
            <option value="secondary">Średnie</option>
            <option value="higher">Wyższe</option>
            <option value="postgraduate">Podyplomowe</option>
          </select>
          {errors.education && <span style={styles.error}>{errors.education.message}</span>}
        </div>
      </div>
      </fieldset>
    </form>
  );
});

Step2_IdentityDocument.displayName = "Step2_IdentityDocument";

const styles: Record<string, React.CSSProperties> = {
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  error: {
    color: "#ef4444",
    fontSize: "0.875rem",
  },
  readOnlyFieldset: {
    border: "none",
    padding: 0,
    margin: 0,
    width: "100%",
  },
};
