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
    formType: template?.formType || "",
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
    <form onSubmit={handleSubmit}>
      <label>
        Consent Type:
        <select name="consentType" value={formData.consentType} onChange={handleChange}>
          <option value="PARTNER_DECLARATION">Partner Declaration</option>
          <option value="MARKETING">Marketing</option>
          <option value="FINANCIAL_PARTNERS">Financial Partners</option>
          <option value="VEHICLE_PARTNERS">Vehicle Partners</option>
        </select>
      </label>
      <label>
        Form Type:
        <select name="formType" value={formData.formType} onChange={handleChange} required>
          <option value="financing_application">Financing Application</option>
          <option value="lead_creation">Lead Creation</option>
        </select>
      </label>
      <label>
        Title:
        <input name="title" value={formData.title} onChange={handleChange} required />
      </label>
      <label>
        Content:
        <textarea name="content" value={formData.content} onChange={handleChange} required />
      </label>
      <label>
        Version:
        <input type="number" name="version" value={formData.version} onChange={handleChange} required min="1" />
      </label>
      <label>
        <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleChange} />
        Active
      </label>
      <label>
        <input type="checkbox" name="isRequired" checked={formData.isRequired} onChange={handleChange} />
        Required
      </label>
      <div>
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
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
    <div>
      <h1>Consent Management</h1>
      <button onClick={() => { setEditingTemplate(null); setIsModalOpen(true); }}>
        Create New Template
      </button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Form Type</th>
            <th>Version</th>
            <th>Active</th>
            <th>Required</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map(template => (
            <tr key={template.id}>
              <td>{template.title}</td>
              <td>{template.consentType}</td>
              <td>{template.formType}</td>
              <td>{template.version}</td>
              <td>{template.isActive ? "Yes" : "No"}</td>
              <td>{template.isRequired ? "Yes" : "No"}</td>
              <td>
                <button onClick={() => { setEditingTemplate(template); setIsModalOpen(true); }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(template.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingTemplate(null); }}>
        <h2>{editingTemplate ? "Edit" : "Create"} Consent Template</h2>
        <ConsentTemplateForm
          template={editingTemplate}
          onSave={handleSave}
          onCancel={() => { setIsModalOpen(false); setEditingTemplate(null); }}
        />
      </Modal>
    </div>
  );
};
