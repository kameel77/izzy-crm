import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ConsentRecordDto, fetchConsentRecords, FetchConsentRecordsParams } from "../api/consents";
import { useToasts } from "../providers/ToastProvider";
import { useDebounce } from "../hooks/useDebounce";
import { API_BASE_URL } from "../api/client";

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
  
  // State for pagination, filtering, and sorting
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
                  <th style={styles.th}>Given</th>
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
                      <span style={record.consentGiven ? styles.badgeSuccess : styles.badgeDanger}>
                        {record.consentGiven ? "Yes" : "No"}
                      </span>
                    </td>
                    <td style={styles.td}>{record.consentMethod}</td>
                    <td style={styles.td}>{record.recordedBy?.fullName || record.recordedBy?.email || "Client"}</td>
                    <td style={styles.td}>{new Date(record.recordedAt).toLocaleString()}</td>
                    <td style={styles.td}>
                      <button style={styles.detailsButton}>Details</button>
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
    </div>
  );
};

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
};