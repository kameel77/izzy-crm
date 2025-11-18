import React, { useState, useEffect, useCallback } from "react";
import {
  ConsentTemplateDto,
  fetchAuthenticatedConsentTemplates,
  createConsentTemplate,
  updateConsentTemplate,
  deleteConsentTemplate,
  CreateConsentTemplatePayload,
  UpdateConsentTemplatePayload,
} from "../api/consents";
import { Modal } from "../components/Modal";
import { useToasts } from "../providers/ToastProvider";

const ConsentTemplateForm: React.FC<{
  template?: ConsentTemplateDto | null;
  onSave: (payload: CreateConsentTemplatePayload | UpdateConsentTemplatePayload) => void;
  onCancel: () => void;
}> = ({ template, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    consentType: template?.consentType || "PARTNER_DECLARATION",
    formType: template?.formType || "financing_application",
    title: template?.title || "",
    content: template?.content || "",
    version: template?.version || 1,
    isActive: template?.isActive !== false,
    isRequired: template?.isRequired || false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, version: Number(formData.version) });
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <label style={styles.label}>
        <span>Consent Type</span>
        <select name="consentType" value={formData.consentType} onChange={handleChange} style={styles.input}>
          <option value="PARTNER_DECLARATION">Partner Declaration</option>
          <option value="MARKETING">Marketing</option>
          <option value="FINANCIAL_PARTNERS">Financial Partners</option>
          <option value="VEHICLE_PARTNERS">Vehicle Partners</option>
        </select>
      </label>
      <label style={styles.label}>
        <span>Form Type</span>
        <select name="formType" value={formData.formType} onChange={handleChange} required style={styles.input}>
          <option value="financing_application">Financing Application</option>
          <option value="lead_creation">Lead Creation</option>
        </select>
      </label>
      <label style={styles.label}>
        <span>Title</span>
        <input name="title" value={formData.title} onChange={handleChange} required style={styles.input} />
      </label>
      <label style={styles.label}>
        <span>Content</span>
        <textarea name="content" value={formData.content} onChange={handleChange} required style={styles.textarea} />
      </label>
      <label style={styles.label}>
        <span>Version</span>
        <input type="number" name="version" value={formData.version} onChange={handleChange} required min="1" style={styles.input} />
      </label>
      <div style={styles.checkboxGroup}>
        <label style={styles.checkboxLabel}>
          <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
          Active
        </label>
        <label style={styles.checkboxLabel}>
          <input type="checkbox" name="isRequired" checked={formData.isRequired} onChange={handleChange} />
          Required
        </label>
      </div>
      <div style={styles.modalActions}>
        <button type="submit" style={styles.primaryButton}>
          Save template
        </button>
        <button type="button" onClick={onCancel} style={styles.secondaryButton}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export const AdminConsentsPage: React.FC = () => {
  const [templates, setTemplates] = useState<ConsentTemplateDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplateDto | null>(null);
  const { addToast } = useToasts();

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAuthenticatedConsentTemplates({ formType: "lead_creation", includeInactive: true });
      const financingData = await fetchAuthenticatedConsentTemplates({ formType: "financing_application", includeInactive: true });
      setTemplates([...data, ...financingData]);
    } catch (err) {
      setError("Failed to load consent templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleSave = async (payload: CreateConsentTemplatePayload | UpdateConsentTemplatePayload) => {
    try {
      if (editingTemplate) {
        await updateConsentTemplate(editingTemplate.id, payload);
        addToast("Template updated successfully!", "success");
      } else {
        await createConsentTemplate(payload as CreateConsentTemplatePayload);
        addToast("Template created successfully!", "success");
      }
      setIsModalOpen(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) { addToast("Failed to save template.", "error"); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        await deleteConsentTemplate(id);
        addToast("Template deleted successfully!", "success");
        loadTemplates();
      } catch (err) {
        addToast("Failed to delete template.", "error");
      }
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.heading}>Consent Management</h1>
          <p style={styles.subtitle}>Create and maintain consent templates for every flow.</p>
        </div>
        <button
          type="button"
          style={styles.createButton}
          onClick={() => {
            setEditingTemplate(null);
            setIsModalOpen(true);
          }}
        >
          Create template
        </button>
      </header>

      {error ? <div style={styles.bannerError}>{error}</div> : null}

      <section style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h2 style={styles.tableTitle}>Templates</h2>
          <span style={styles.caption}>{templates.length} total</span>
        </div>
        {loading ? (
          <p style={styles.message}>Loading templates...</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Form Type</th>
                  <th>Version</th>
                  <th>Active</th>
                  <th>Required</th>
                  <th style={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.title}</td>
                    <td>{template.consentType}</td>
                    <td>{template.formType}</td>
                    <td>{template.version}</td>
                    <td>{template.isActive ? "Yes" : "No"}</td>
                    <td>{template.isRequired ? "Yes" : "No"}</td>
                    <td style={styles.actionsCell}>
                      <div style={styles.actionGroup}>
                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() => {
                            setEditingTemplate(template);
                            setIsModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                        <button type="button" style={styles.dangerButton} onClick={() => handleDelete(template.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTemplate(null);
        }}
        title={`${editingTemplate ? "Edit" : "Create"} Consent Template`}
      >
        <ConsentTemplateForm
          template={editingTemplate}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingTemplate(null);
          }}
        />
      </Modal>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
    width: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    flexWrap: "wrap",
    padding: "1.5rem",
    borderRadius: "1rem",
    background: "#fff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.08)",
  },
  heading: {
    margin: 0,
    fontSize: "2rem",
  },
  subtitle: {
    margin: "0.25rem 0 0",
    color: "#6b7280",
  },
  createButton: {
    padding: "0.6rem 1.25rem",
    borderRadius: 10,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
  },
  bannerError: {
    background: "#fee2e2",
    color: "#b91c1c",
    padding: "0.75rem 1rem",
    borderRadius: 10,
  },
  tableCard: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.06)",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableTitle: {
    margin: 0,
  },
  caption: {
    color: "#6b7280",
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  actionsHeader: {
    textAlign: "right",
  },
  actionsCell: {
    textAlign: "right",
  },
  actionGroup: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  primaryButton: {
    padding: "0.45rem 1rem",
    borderRadius: 8,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  secondaryButton: {
    padding: "0.45rem 1rem",
    borderRadius: 8,
    border: "1px solid #2563eb",
    background: "transparent",
    color: "#2563eb",
    cursor: "pointer",
    fontWeight: 600,
  },
  dangerButton: {
    padding: "0.45rem 1rem",
    borderRadius: 8,
    border: "1px solid #ef4444",
    background: "#fef2f2",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 600,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    fontWeight: 500,
    color: "#0f172a",
  },
  input: {
    padding: "0.6rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
  },
  textarea: {
    minHeight: 140,
    padding: "0.6rem 0.75rem",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontFamily: "inherit",
  },
  checkboxGroup: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontWeight: 500,
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  message: {
    margin: 0,
    color: "#6b7280",
  },
};
