import React, { useState, useEffect, useCallback, useId } from "react";
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
import { Button, Card, Checkbox, DataTable, Select, TextField } from "../components/ui";
import type { DataTableColumn } from "../components/ui";
import { useToasts } from "../providers/ToastProvider";

const ConsentTemplateForm: React.FC<{
  template?: ConsentTemplateDto | null;
  onSave: (payload: CreateConsentTemplatePayload | UpdateConsentTemplatePayload) => void;
  onCancel: () => void;
}> = ({ template, onSave, onCancel }) => {
  const contentId = useId();
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
    <form onSubmit={handleSubmit} className="app-form">
      <Select
        label="Consent type"
        name="consentType"
        value={formData.consentType}
        onChange={handleChange}
        options={[
          { value: "PARTNER_DECLARATION", label: "Partner declaration" },
          { value: "MARKETING", label: "Marketing" },
          { value: "FINANCIAL_PARTNERS", label: "Financial partners" },
          { value: "VEHICLE_PARTNERS", label: "Vehicle partners" },
        ]}
      />
      <Select
        label="Form type"
        name="formType"
        value={formData.formType}
        onChange={handleChange}
        required
        options={[
          { value: "financing_application", label: "Financing application" },
          { value: "lead_creation", label: "Lead creation" },
          { value: "onboarding_insurance", label: "Onboarding insurance" },
        ]}
      />
      <TextField label="Title" name="title" value={formData.title} onChange={handleChange} required />
      <div className="iz-field">
        <label className="iz-field__label" htmlFor={contentId}>
          Content
        </label>
        <textarea
          id={contentId}
          className="app-textarea app-adm-textarea"
          name="content"
          value={formData.content}
          onChange={handleChange}
          required
        />
      </div>
      <TextField
        label="Version"
        type="number"
        name="version"
        value={formData.version}
        onChange={handleChange}
        required
        min="1"
      />
      <div className="app-adm-checks">
        <Checkbox label="Active" name="isActive" checked={formData.isActive} onChange={handleChange} />
        <Checkbox label="Required" name="isRequired" checked={formData.isRequired} onChange={handleChange} />
      </div>
      <div className="app-form-actions">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save template
        </Button>
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
      const onboardingData = await fetchAuthenticatedConsentTemplates({ formType: "onboarding_insurance", includeInactive: true });
      setTemplates([...data, ...financingData, ...onboardingData]);
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

  const columns: DataTableColumn<ConsentTemplateDto>[] = [
    { key: "title", header: "Title", render: (template) => template.title },
    { key: "consentType", header: "Type", render: (template) => template.consentType },
    { key: "formType", header: "Form type", render: (template) => template.formType },
    { key: "version", header: "Version", align: "right", render: (template) => template.version },
    { key: "isActive", header: "Active", render: (template) => (template.isActive ? "Yes" : "No") },
    { key: "isRequired", header: "Required", render: (template) => (template.isRequired ? "Yes" : "No") },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (template) => (
        <div className="app-adm-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditingTemplate(template);
              setIsModalOpen(true);
            }}
          >
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="app-page">
      <div className="app-title-row">
        <div>
          <h1 className="app-page-title">Consent management</h1>
          <p className="app-page-desc">Create and maintain consent templates for every flow.</p>
        </div>
        <div className="app-title-row__acts">
          <Button
            variant="primary"
            icon="plus"
            onClick={() => {
              setEditingTemplate(null);
              setIsModalOpen(true);
            }}
          >
            Create template
          </Button>
        </div>
      </div>

      {error ? <div className="app-alert app-alert--danger">{error}</div> : null}

      <Card title="Templates" subtitle={`${templates.length} total`} flush>
        {loading ? (
          <p className="app-empty">Loading templates...</p>
        ) : (
          <DataTable rows={templates} rowKey="id" columns={columns} empty="No consent templates yet." />
        )}
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTemplate(null);
        }}
        title={`${editingTemplate ? "Edit" : "Create"} consent template`}
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
