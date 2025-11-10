import React, { useState, useEffect, useCallback } from "react";
import { ConsentRecordDto, fetchConsentRecords, FetchConsentRecordsParams } from "../api/consents";
import { useToasts } from "../providers/ToastProvider";
import { AppLayout } from "../components/AppLayout";

export const AdminConsentRecordsPage: React.FC = () => {
  const [records, setRecords] = useState<ConsentRecordDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { addToast } = useToasts();

  const loadRecords = useCallback(async (params?: FetchConsentRecordsParams) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchConsentRecords({
        ...params,
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      });
      setRecords(response.data);
      setTotalCount(response.count);
    } catch (err) {
      setError("Failed to load consent records.");
      addToast("Failed to load consent records.", "error");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, addToast]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <AppLayout>
      <h1>Consent Records Archive</h1>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Lead</th>
                <th>Consent Type</th>
                <th>Template Title</th>
                <th>Version</th>
                <th>Given</th>
                <th>Method</th>
                <th>Recorded By</th>
                <th>Recorded At</th>
                <th>Partner</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.id}>
                  <td>{record.lead.customerProfile ? `${record.lead.customerProfile.firstName} ${record.lead.customerProfile.lastName}` : record.lead.id}</td>
                  <td>{record.consentType}</td>
                  <td>{record.consentTemplate.title}</td>
                  <td>{record.version}</td>
                  <td>{record.consentGiven ? "Yes" : "No"}</td>
                  <td>{record.consentMethod}</td>
                  <td>{record.recordedBy ? record.recordedBy.fullName : "N/A"}</td>
                  <td>{new Date(record.recordedAt).toLocaleString()}</td>
                  <td>{record.partner ? record.partner.name : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Total records: {totalCount}</span>
            <div>
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
              <span style={{ margin: "0 1rem" }}>Page {currentPage} of {totalPages}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
