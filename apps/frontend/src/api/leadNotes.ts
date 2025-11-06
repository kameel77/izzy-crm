import { apiFetch } from "./client";

export interface LeadNoteTag {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadNoteAuthor {
  id: string;
  fullName?: string | null;
  email: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: LeadNoteAuthor | null;
  tags: LeadNoteTag[];
}

export interface LeadNoteFilters {
  tagIds?: string[];
}

export const fetchLeadNotes = async (
  token: string,
  leadId: string,
  filters: LeadNoteFilters = {},
): Promise<LeadNote[]> => {
  const params = new URLSearchParams();
  if (filters.tagIds && filters.tagIds.length) {
    params.set("tagIds", filters.tagIds.join(","));
  }

  const query = params.toString();
  const path = `/api/leads/${leadId}/notes${query ? `?${query}` : ""}`;
  const response = await apiFetch<{ data: LeadNote[] }>(path, { token });

  return response.data;
};

export const createLeadNote = (
  token: string,
  leadId: string,
  payload: { content: string; tagIds?: string[] },
) =>
  apiFetch<LeadNote>(`/api/leads/${leadId}/notes`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const updateLeadNote = (
  token: string,
  leadId: string,
  noteId: string,
  payload: { content?: string; tagIds?: string[] },
) =>
  apiFetch<LeadNote>(`/api/leads/${leadId}/notes/${noteId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export const deleteLeadNote = (token: string, leadId: string, noteId: string) =>
  apiFetch<void>(`/api/leads/${leadId}/notes/${noteId}`, {
    method: "DELETE",
    token,
  });

export const fetchLeadNoteTags = async (token: string): Promise<LeadNoteTag[]> => {
  const response = await apiFetch<{ data: LeadNoteTag[] }>("/api/note-tags", { token });
  return response.data;
};

export const createLeadNoteTag = (token: string, payload: { name: string }) =>
  apiFetch<LeadNoteTag>("/api/note-tags", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const updateLeadNoteTag = (token: string, id: string, payload: { name: string }) =>
  apiFetch<LeadNoteTag>(`/api/note-tags/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export const deleteLeadNoteTag = (token: string, id: string) =>
  apiFetch<void>(`/api/note-tags/${id}`, {
    method: "DELETE",
    token,
  });
