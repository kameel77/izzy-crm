import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ConsentRecordDto, fetchConsentRecords, FetchConsentRecordsParams, withdrawConsent } from "../api/consents";
import { useToasts } from "../providers/ToastProvider";
import { useDebounce } from "../hooks/useDebounce";
import { API_BASE_URL } from "../api/client";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";

const buildExportUrl = (params: Omit<FetchConsentRecordsParams, "skip" | "take">, format: "csv" | "json") => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      if (value instanceof Date) {
        query.set(key, value.toISOString());
      } else {
        query.set(key, String(value));
      }
    }
  }
  query.set("format", format);
  return `${API_BASE_URL}/api/consent-records/export?${query.toString()}`;
};

export const AdminConsentRecordsPage: React.FC = () => {
  const [records, setRecords] = useState<ConsentRecordDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedRecord, setSelectedRecord] = useState<ConsentRecordDto | null>(null);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [clientSearch, setClientSearch] = useState("");
  const [filters, setFilters] = useState<Partial<FetchConsentRecordsParams>>({
    consentType: undefined,
    consentMethod: undefined,
    consentGiven: undefined,
  });
  const [sortBy, setSortBy] = useState<FetchConsentRecordsParams["sortBy"]>("recordedAt");
  const [sortOrder, setSortOrder] = useState<FetchConsentRecordsParams["sortOrder"]>("desc");

  const debouncedClientSearch = useDebounce(clientSearch, 300);
  const { addToast } = useToasts();
  const { user } = useAuth();

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: FetchConsentRecordsParams = {
        ...filters,
        clientSearch: debouncedClientSearch || undefined,
        sortBy,
        sortOrder,
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      };
      const response = await fetchConsentRecords(params);
      setRecords(response.data);
      setTotalCount(response.count);
    } catch (err) {
      const errorMessage = "Failed to load consent records.";
      setError(errorMessage);
      addToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, addToast, filters, debouncedClientSearch, sortBy, sortOrder]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value === "" ? undefined : value,
    }));
    setCurrentPage(1);
  };

  const handleSortChange = (field: FetchConsentRecordsParams["sortBy"]) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const handleExport = (format: "csv" | "json") => {
    const exportParams: Omit<FetchConsentRecordsParams, "skip" | "take"> = {
      ...filters,
      clientSearch: debouncedClientSearch || undefined,
      sortBy,
      sortOrder,
    };
    const url = buildExportUrl(exportParams, format);
    window.open(url, "_blank");
    addToast(`Exporting records to ${format.toUpperCase()}...`, "success");
  };

  const canWithdrawRecord = (record: ConsentRecordDto | null) => {
    if (!record || !user) return false;
    if (user.role === "ADMIN" || user.role === "SUPERVISOR") return true;
    if (user.role === "OPERATOR") {
      return record.consentType === "PARTNER_DECLARATION";
    }
    return false;
  };

  const handleWithdrawConfirm = async () => {
    if (!selectedRecord || !canWithdrawRecord(selectedRecord)) return;

    setIsWithdrawing(true);
    try {
      await withdrawConsent(selectedRecord.id);
      addToast("Consent withdrawn successfully.", "success");
      setIsWithdrawModalOpen(false);
      setSelectedRecord(null);
      loadRecords(); // Refresh the list
    } catch (err) {
      addToast("Failed to withdraw consent.", "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Consent Records Archive</h1>
        <div style={styles.exportButtons}>
          <button onClick={() => handleExport("csv")} style={styles.button}>Export CSV</button>
          <button onClick={() => handleExport("json")} style={styles.button}>Export JSON</button>
        </div>
      </header>

      <div style={styles.filters}>
        <input
          type="text"
          placeholder="Search by client name, email, phone..."
          value={clientSearch}
          onChange={e => setClientSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select name="consentType" onChange={handleFilterChange} style={styles.select}>
          <option value="">All Types</option>
          <option value="MARKETING">Marketing</option>
          <option value="FINANCIAL_PARTNERS">Financial Partners</option>
          <option value="VEHICLE_PARTNERS">Vehicle Partners</option>
          <option value="PARTNER_DECLARATION">Partner Declaration</option>
        </select>
        <select name="consentMethod" onChange={handleFilterChange} style={styles.select}>
          <option value="">All Methods</option>
          <option value="ONLINE_FORM">Online Form</option>
          <option value="PHONE_CALL">Phone Call</option>
          <option value="PARTNER_SUBMISSION">Partner Submission</option>
        </select>
        <select name="consentGiven" onChange={handleFilterChange} style={styles.select}>
          <option value="">Any Status</option>
          <option value="true">Given</option>
          <option value="false">Not Given</option>
        </select>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th onClick={() => handleSortChange("clientName")} style={styles.th}>Client</th>
                  <th onClick={() => handleSortChange("consentType")} style={styles.th}>Consent Type</th>
                  <th style={styles.th}>Template</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Method</th>
                  <th style={styles.th}>Recorded By</th>
                  <th onClick={() => handleSortChange("recordedAt")} style={styles.th}>Recorded At</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id}>
                    <td style={styles.td}>
                      <Link to={`/leads/${record.lead.id}`}>
                        {record.lead.customerProfile ? `${record.lead.customerProfile.firstName} ${record.lead.customerProfile.lastName}` : record.lead.id}
                      </Link>
                    </td>
                    <td style={styles.td}>{record.consentType}</td>
                    <td style={styles.td}>{record.consentTemplate.title} (v{record.consentTemplate.version})</td>
                    <td style={styles.td}>
                      {record.withdrawnAt ? (
                        <span style={styles.badgeWithdrawn}>Withdrawn</span>
                      ) : (
                        <span style={record.consentGiven ? styles.badgeSuccess : styles.badgeDanger}>
                          {record.consentGiven ? "Given" : "Not Given"}
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>{record.consentMethod}</td>
                    <td style={styles.td}>{record.recordedBy?.fullName || record.recordedBy?.email || "Client"}</td>
                    <td style={styles.td}>{new Date(record.recordedAt).toLocaleString()}</td>
                    <td style={styles.td}>
                      <button onClick={() => setSelectedRecord(record)} style={styles.detailsButton}>Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.pagination}>
            <span>Total records: {totalCount}</span>
            <div>
              <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} style={styles.button}>Previous</button>
              <span style={{ margin: "0 1rem" }}>Page {currentPage} of {totalPages || 1}</span>
              <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages} style={styles.button}>Next</button>
            </div>
          </div>
        </>
      )}

      {selectedRecord && (
        <Modal isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title="Consent Record Details">
          <div style={styles.modalContent}>
            <div style={styles.modalGrid}>
              <InfoItem label="Client" value={`${selectedRecord.lead.customerProfile?.firstName} ${selectedRecord.lead.customerProfile?.lastName}`} />
              <InfoItem label="Lead ID" value={<Link to={`/leads/${selectedRecord.lead.id}`}>{selectedRecord.lead.id}</Link>} />
              <InfoItem label="Consent Title" value={selectedRecord.consentTemplate.title} />
              <InfoItem label="Template Version" value={selectedRecord.version} />
              <InfoItem label="Status" value={selectedRecord.withdrawnAt ? `Withdrawn at ${new Date(selectedRecord.withdrawnAt).toLocaleString()}` : selectedRecord.consentGiven ? "Given" : "Not Given"} />
              <InfoItem label="Method" value={selectedRecord.consentMethod} />
              <InfoItem label="Recorded At" value={new Date(selectedRecord.recordedAt).toLocaleString()} />
              <InfoItem label="Recorded By" value={selectedRecord.recordedBy?.fullName || selectedRecord.recordedBy?.email || "Client / Automated"} />
              <InfoItem label="Partner" value={selectedRecord.partner?.name || "N/A"} />
              <InfoItem label="IP Address" value={selectedRecord.ipAddress || "N/A"} />
              <InfoItem label="User Agent" value={selectedRecord.userAgent || "N/A"} />
            </div>
            <hr style={styles.hr} />
            <div>
              <h4 style={styles.modalSubheading}>Full Consent Text (Snapshot)</h4>
              <pre style={styles.consentTextPre}>{selectedRecord.consentText}</pre>
            </div>
            {!selectedRecord.withdrawnAt && canWithdrawRecord(selectedRecord) && (
              <div style={styles.modalActions}>
                <button onClick={() => setIsWithdrawModalOpen(true)} style={styles.withdrawButton}>Withdraw Consent</button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {isWithdrawModalOpen && (
        <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Confirm Withdrawal">
          <div>
            <p>Are you sure you want to withdraw this consent? This action cannot be undone.</p>
            <div style={styles.modalActions}>
              <button onClick={() => setIsWithdrawModalOpen(false)} style={styles.button}>Cancel</button>
              <button onClick={handleWithdrawConfirm} disabled={isWithdrawing} style={styles.withdrawButton}>
                {isWithdrawing ? "Withdrawing..." : "Confirm Withdraw"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <strong style={styles.infoLabel}>{label}:</strong>
    <span style={styles.infoValue}>{value}</span>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "1rem 2rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" },
  exportButtons: { display: "flex", gap: "0.5rem" },
  filters: { display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" },
  searchInput: { flexGrow: 1, padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" },
  select: { padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { borderBottom: "2px solid #eee", padding: "0.75rem", textAlign: "left", cursor: "pointer" },
  td: { borderBottom: "1px solid #eee", padding: "0.75rem" },
  pagination: { marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  button: { padding: "0.5rem 1rem", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer" },
  detailsButton: { padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer", background: "#f0f0f0" },
  badgeSuccess: { backgroundColor: "#dcfce7", color: "#166534", padding: "0.25rem 0.5rem", borderRadius: "999px", fontSize: "0.8rem" },
  badgeDanger: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "0.25rem 0.5rem", borderRadius: "999px", fontSize: "0.8rem" },
  badgeWithdrawn: { backgroundColor: "#e5e7eb", color: "#4b5563", padding: "0.25rem 0.5rem", borderRadius: "999px", fontSize: "0.8rem" },
  modalContent: { display: "flex", flexDirection: "column", gap: "1rem" },
  modalGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  infoLabel: { marginRight: "0.5rem", color: "#555" },
  infoValue: {},
  hr: { border: "none", borderTop: "1px solid #eee", margin: "0.5rem 0" },
  modalSubheading: { margin: "0 0 0.5rem 0" },
  consentTextPre: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "#f7f7f7",
    padding: "0.75rem",
    borderRadius: "4px",
    maxHeight: "200px",
    overflowY: "auto",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" },
  withdrawButton: {
    backgroundColor: "#ef4444",
    color: "white",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "4px",
    cursor: "pointer",
  },
};
