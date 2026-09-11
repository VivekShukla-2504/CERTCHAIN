import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function StatusBadge({ revoked }) {
  return <span className={`badge ${revoked ? "badge-revoked" : "badge-success"}`}>{revoked ? "Revoked" : "Active"}</span>;
}

function Detail({ label, children, wide = false }) {
  return <div className={`certificate-detail-item${wide ? " wide" : ""}`}><dt>{label}</dt><dd>{children}</dd></div>;
}

export default function CertificateDetails() {
  const { certId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get(`/certificates/${encodeURIComponent(certId)}`)
      .then((response) => { if (active) setCertificate(response.data); })
      .catch((requestError) => { if (active) setError(requestError.response?.status === 404 ? "not-found" : requestError.response?.data?.message || "Certificate details could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [certId]);

  async function copyValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  async function verifyCertificate() {
    setVerifying(true);
    setVerification(null);
    try {
      const response = await api.post("/verify", { certId: certificate.certId });
      setVerification({ verified: response.data.verified, message: response.data.message });
    } catch (requestError) {
      setVerification({ verified: false, message: requestError.response?.data?.message || "Verification could not be completed." });
    } finally {
      setVerifying(false);
    }
  }

  async function revokeCertificate() {
    if (certificate.revoked || !window.confirm(`Revoke certificate ${certificate.certId}? This is permanent and cannot be undone.`)) return;
    setRevoking(true);
    try {
      await api.post(`/certificates/${encodeURIComponent(certificate.certId)}/revoke`);
      setCertificate((current) => ({ ...current, revoked: true }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Certificate could not be revoked.");
    } finally {
      setRevoking(false);
    }
  }

  if (loading) return <div className="page certificate-details-page"><div className="details-loading"><span /><span /><span /><span /></div></div>;
  if (error === "not-found") return <div className="page certificate-details-page"><div className="details-state card card-pad"><span className="empty-icon">?</span><h1>Certificate not found</h1><p className="lead">This certificate does not exist in your institution workspace.</p><Link className="button button-secondary" to="/certificates">Back to certificates</Link></div></div>;
  if (error || !certificate) return <div className="page certificate-details-page"><div className="details-state card card-pad"><Alert>{error || "Certificate details could not be loaded."}</Alert><Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button></div></div>;

  return <div className="page certificate-details-page">
    <div className="detail-back"><Link to="/certificates">← Back to certificates</Link></div>
    <div className="page-header certificate-detail-heading"><div><span className="eyebrow">Certificate record</span><h1>{certificate.certId}</h1><p className="lead">Issued to {certificate.candidateName} by {certificate.institutionId || "your institution"}.</p></div><StatusBadge revoked={certificate.revoked} /></div>
    <div className="certificate-detail-layout">
      <section className="card card-pad certificate-detail-card"><div className="detail-card-heading"><div><h2>Certificate information</h2><p className="muted small">Stored certificate data from your institution registry.</p></div><span className="detail-seal">{certificate.revoked ? "!" : "✓"}</span></div><dl className="certificate-details-grid"><Detail label="Certificate ID"><span className="mono">{certificate.certId}</span><button className="copy-action" onClick={() => copyValue(certificate.certId, "id")}>{copied === "id" ? "Copied" : "Copy"}</button></Detail><Detail label="Student">{certificate.candidateName}</Detail><Detail label="Institution">{certificate.institutionId || "Not available"}</Detail><Detail label="Course / degree">{certificate.course}</Detail><Detail label="Roll number">{certificate.rollNumber}</Detail><Detail label="Grade">{certificate.grade}</Detail><Detail label="Issue date">{formatDate(certificate.issueDate)}</Detail><Detail label="Status"><StatusBadge revoked={certificate.revoked} /></Detail></dl></section>
      <aside className="certificate-side-column"><section className="card card-pad blockchain-card"><span className="eyebrow">Blockchain record</span><h2>Transaction status</h2><div className="chain-record-status"><span className="status-dot" /><strong>{certificate.txHash ? "Transaction recorded" : "Transaction unavailable"}</strong></div><p className="muted small">The transaction hash stored with this certificate is shown below.</p><div className="transaction-box"><span className="meta-label">Transaction hash</span><span className="mono">{certificate.txHash || "Not available"}</span>{certificate.txHash && <button className="copy-action" onClick={() => copyValue(certificate.txHash, "tx")}>{copied === "tx" ? "Copied" : "Copy hash"}</button>}</div></section><section className="card card-pad detail-actions"><h3>Actions</h3><Button className="button-block" onClick={verifyCertificate} loading={verifying}>{verifying ? "Verifying record" : "Verify certificate"}</Button>{!certificate.revoked && <Button className="button-block button-danger" onClick={revokeCertificate} loading={revoking}>{revoking ? "Revoking certificate" : "Revoke certificate"}</Button>}{certificate.revoked && <div className="detail-verification failed"><strong>Certificate revoked</strong><span>This certificate remains permanently recorded and cannot be issued again.</span></div>}{verification && <div className={`detail-verification ${verification.verified ? "verified" : "failed"}`}><strong>{verification.verified ? "Verified" : "Verification failed"}</strong><span>{verification.message}</span></div>}<Button className="button-block" variant="secondary" onClick={() => navigate("/certificates")}>Back to certificates</Button></section></aside>
    </div>
  </div>;
}
