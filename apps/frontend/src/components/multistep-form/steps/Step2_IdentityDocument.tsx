import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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
}

export const Step2_IdentityDocument: React.FC<Step2Props> = ({ onFormChange, formData }) => {
  const {
    register,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData,
  });

  const watchedData = watch();
  useEffect(() => {
    onFormChange(watchedData);
  }, [JSON.stringify(watchedData), onFormChange]);

  return (
    <form>
      <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Krok 2: Dokument tożsamości</h2>
      <div style={styles.grid}>
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
          <input id="issueDate" type="date" {...register("issueDate")} />
          {errors.issueDate && <span style={styles.error}>{errors.issueDate.message}</span>}
        </div>
        <div style={styles.field}>
          <label htmlFor="expiryDate">Data ważności</label>
          <input id="expiryDate" type="date" {...register("expiryDate")} />
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
    </form>
  );
};

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