import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function StatCard({ label, value, detail, tone = "blue" }) {
  return <article className={`dashboard-stat stat-${tone}`}><span className="stat-label">{label}</span><strong>{value === null ? "—" : value.toLocaleString()}</strong><span className="stat-detail">{detail}</span></article>;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/certificates")
      .then((response) => { if (active) setData(response.data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Dashboard data could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="page dashboard-page"><div className="page-header"><div><span className="eyebrow">Workspace overview</span><h1>Dashboard</h1></div></div><div className="dashboard-skeleton" aria-label="Loading dashboard"><div /><div /><div /><div /></div></div>;
  if (error) return <div className="page dashboard-page"><div className="page-header"><div><span className="eyebrow">Workspace overview</span><h1>Dashboard</h1></div></div><div className="dashboard-error card card-pad"><Alert>{error}</Alert><Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button></div></div>;

  const stats = data?.stats || { total: 0, verified: 0, revoked: 0, pending: null };
  const certificates = data?.certificates || [];
  return <div className="page dashboard-page">
    <div className="page-header dashboard-heading"><div><span className="eyebrow">Workspace overview</span><h1>Dashboard</h1><p className="lead">A clear view of your certificate registry and its latest activity.</p></div><Link className="button button-primary" to="/issue">＋ Issue certificate</Link></div>
    <section className="dashboard-stats" aria-label="Certificate statistics">
      <StatCard label="Total certificates" value={stats.total} detail="All issued records" tone="blue" />
      <StatCard label="Verified certificates" value={stats.verified} detail="Active records" tone="green" />
      <StatCard label="Revoked certificates" value={stats.revoked} detail="Marked revoked" tone="red" />
      <StatCard label="Pending transactions" value={stats.pending} detail={data?.pendingAvailable ? "Awaiting confirmation" : "Not tracked by current API"} tone="neutral" />
    </section>
    <section className="dashboard-content-grid">
      <article className="card dashboard-panel"><div className="panel-heading"><div><h2>Recent certificates</h2><p className="muted small">The latest records issued by your institution.</p></div><span className="badge badge-neutral">{certificates.length} shown</span></div>
        {certificates.length === 0 ? <div className="dashboard-empty"><span className="empty-icon">＋</span><h3>No certificates yet</h3><p>Issued certificates will appear here once they are created.</p><Link className="button button-secondary" to="/issue">Issue your first certificate</Link></div> : <div className="certificate-list">{certificates.map((certificate) => <div className="certificate-row" key={certificate.certId}><div className="certificate-icon">{certificate.revoked ? "!" : "✓"}</div><div className="certificate-main"><strong>{certificate.candidateName}</strong><span>{certificate.course} · {certificate.certId}</span></div><div className="certificate-date"><span className={`badge ${certificate.revoked ? "badge-revoked" : "badge-success"}`}>{certificate.revoked ? "Revoked" : "Verified"}</span><small>{formatDate(certificate.createdAt || certificate.issueDate)}</small></div></div>)}</div>}
      </article>
      <article className="card dashboard-panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p className="muted small">Activity based on certificate records.</p></div></div>{certificates.length === 0 ? <div className="activity-empty">No activity to show yet.</div> : <div className="activity-list">{certificates.slice(0, 5).map((certificate) => <div className="activity-item" key={`activity-${certificate.certId}`}><span className={`activity-dot ${certificate.revoked ? "revoked" : ""}`} /><div><strong>{certificate.revoked ? "Certificate revoked" : "Certificate issued"}</strong><p>{certificate.certId} · {formatDate(certificate.updatedAt || certificate.createdAt)}</p></div></div>)}</div>}</article>
    </section>
  </div>;
}
