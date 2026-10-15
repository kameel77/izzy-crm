import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { ConsentRecordDto, fetchConsentRecords, FetchConsentRecordsParams, withdrawConsent } from "../api/consents";
import { useToasts } from "../providers/ToastProvider";
import { useDebounce } from "../hooks/useDebounce";
import { API_BASE_URL } from "../api/client";
import { Modal } from "../components/Modal";
import { Badge, Button, Card, Select, TextField } from "../components/ui";
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
  const [pageSize, _setPageSize] = useState(50);
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
    <div className="app-page">
      <div className="app-title-row">
        <h1 className="app-page-title">Consent records archive</h1>
        <div className="app-title-row__acts">
          <Button variant="secondary" onClick={() => handleExport("csv")}>Export CSV</Button>
          <Button variant="secondary" onClick={() => handleExport("json")}>Export JSON</Button>
        </div>
      </div>

      <div className="app-adm-filters">
        <TextField
          type="text"
          icon="search"
          aria-label="Search by client name, email, phone"
          className="app-adm-filters__search"
          placeholder="Search by client name, email, phone..."
          value={clientSearch}
          onChange={e => setClientSearch(e.target.value)}
        />
        <Select
          aria-label="Consent type"
          name="consentType"
          onChange={handleFilterChange}
          options={[
            { value: "", label: "All types" },
            { value: "MARKETING", label: "Marketing" },
            { value: "FINANCIAL_PARTNERS", label: "Financial partners" },
            { value: "VEHICLE_PARTNERS", label: "Vehicle partners" },
            { value: "PARTNER_DECLARATION", label: "Partner declaration" },
          ]}
        />
        <Select
          aria-label="Consent method"
          name="consentMethod"
          onChange={handleFilterChange}
          options={[
            { value: "", label: "All methods" },
            { value: "ONLINE_FORM", label: "Online form" },
            { value: "PHONE_CALL", label: "Phone call" },
            { value: "PARTNER_SUBMISSION", label: "Partner submission" },
          ]}
        />
        <Select
          aria-label="Consent status"
          name="consentGiven"
          onChange={handleFilterChange}
          options={[
            { value: "", label: "Any status" },
            { value: "true", label: "Given" },
            { value: "false", label: "Not given" },
          ]}
        />
      </div>

      {loading && <p className="app-muted">Loading...</p>}
      {error && <div className="app-alert app-alert--danger">{error}</div>}

      {!loading && !error && (
        <Card
          flush
          footer={
            <div className="app-adm-pager">
              <span>Total records: {totalCount}</span>
              <div className="app-adm-pager__nav">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="chevron-left"
                  onClick={() => setCurrentPage(p => p - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="iz-tnum">Page {currentPage} of {totalPages || 1}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  iconRight="chevron-right"
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          }
        >
          <div className="iz-table-wrap">
            <table className="iz-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortChange("clientName")} className="app-adm-th--sort">Client</th>
                  <th onClick={() => handleSortChange("consentType")} className="app-adm-th--sort">Consent type</th>
                  <th>Template</th>
                  <th>Status</th>
                  <th>Method</th>
                  <th>Recorded by</th>
                  <th onClick={() => handleSortChange("recordedAt")} className="app-adm-th--sort">Recorded at</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(record => (
                  <tr key={record.id}>
                    <td>
                      <Link to={`/leads/${record.lead.id}`} className="app-link">
                        {record.lead.customerProfile ? `${record.lead.customerProfile.firstName} ${record.lead.customerProfile.lastName}` : record.lead.id}
                      </Link>
                    </td>
                    <td>
                      <Badge tone="neutral">{record.consentType}</Badge>
                    </td>
                    <td>{record.consentTemplate.title} (v{record.consentTemplate.version})</td>
                    <td>
                      {record.withdrawnAt ? (
                        <Badge tone="neutral">Withdrawn</Badge>
                      ) : (
                        <Badge tone={record.consentGiven ? "success" : "danger"}>
                          {record.consentGiven ? "Given" : "Not given"}
                        </Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone="neutral">{record.consentMethod}</Badge>
                    </td>
                    <td>{record.recordedBy?.fullName || record.recordedBy?.email || "Client"}</td>
                    <td>{new Date(record.recordedAt).toLocaleString()}</td>
                    <td>
                      <Button variant="secondary" size="sm" onClick={() => setSelectedRecord(record)}>Details</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedRecord && (
        <Modal isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title="Consent record details">
          <div className="app-form">
            <div className="app-kv app-adm-kv">
              <InfoItem label="Client" value={`${selectedRecord.lead.customerProfile?.firstName} ${selectedRecord.lead.customerProfile?.lastName}`} />
              <InfoItem label="Lead ID" value={<Link to={`/leads/${selectedRecord.lead.id}`} className="app-link">{selectedRecord.lead.id}</Link>} />
              <InfoItem label="Consent title" value={selectedRecord.consentTemplate.title} />
              <InfoItem label="Template version" value={selectedRecord.version} />
              <InfoItem label="Status" value={selectedRecord.withdrawnAt ? `Withdrawn at ${new Date(selectedRecord.withdrawnAt).toLocaleString()}` : selectedRecord.consentGiven ? "Given" : "Not given"} />
              <InfoItem label="Method" value={selectedRecord.consentMethod} />
              <InfoItem label="Recorded at" value={new Date(selectedRecord.recordedAt).toLocaleString()} />
              <InfoItem label="Recorded by" value={selectedRecord.recordedBy?.fullName || selectedRecord.recordedBy?.email || "Client / Automated"} />
              <InfoItem label="Partner" value={selectedRecord.partner?.name || "N/A"} />
              <InfoItem label="IP address" value={selectedRecord.ipAddress || "N/A"} />
              <InfoItem label="User agent" value={selectedRecord.userAgent || "N/A"} />
            </div>
            <hr className="app-adm-hr" />
            <div>
              <h4 className="app-section-title app-adm-subheading">Full consent text (snapshot)</h4>
              <pre className="app-adm-pre">{selectedRecord.consentText}</pre>
            </div>
            {!selectedRecord.withdrawnAt && canWithdrawRecord(selectedRecord) && (
              <div className="app-form-actions">
                <Button variant="secondary" onClick={() => setIsWithdrawModalOpen(true)}>Withdraw consent</Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {isWithdrawModalOpen && (
        <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Confirm withdrawal">
          <div className="app-form">
            <p className="app-adm-text">Are you sure you want to withdraw this consent? This action cannot be undone.</p>
            <div className="app-form-actions">
              <Button variant="secondary" onClick={() => setIsWithdrawModalOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleWithdrawConfirm} disabled={isWithdrawing}>
                {isWithdrawing ? "Withdrawing..." : "Confirm withdraw"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

const InfoItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <div className="app-kv__label">{label}</div>
    <div className="app-kv__value">{value}</div>
  </div>
);
