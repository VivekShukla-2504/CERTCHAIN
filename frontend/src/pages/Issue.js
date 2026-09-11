import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Alert, Button, Field } from "../components/UI";

const transactionSteps = ["Preparing", "Submitting", "Pending", "Confirmed"];

function TransactionStatus({ state }) {
  if (state === "idle") return null;
  const activeIndex = state === "preparing" ? 0 : state === "submitting" ? 1 : state === "confirmed" ? 3 : -1;
  const failed = state === "failed";
  const message = state === "preparing"
    ? "Validating certificate details before submitting the transaction."
    : state === "submitting"
      ? "The backend is submitting the certificate hash to the blockchain."
      : state === "confirmed"
        ? "The transaction was confirmed and the certificate record was saved."
        : "The transaction could not be completed. No certificate was confirmed.";

  return <section className={`transaction-status ${failed ? "transaction-failed" : state === "confirmed" ? "transaction-confirmed" : ""}`} aria-live="polite">
    <div className="transaction-status-heading"><div><span className="eyebrow">Blockchain transaction</span><h3>{failed ? "Transaction failed" : state === "confirmed" ? "Transaction confirmed" : "Issuance in progress"}</h3></div><span className={`transaction-state-icon ${failed ? "failed" : state === "confirmed" ? "confirmed" : "active"}`}>{failed ? "!" : state === "confirmed" ? "✓" : ""}</span></div>
    <p>{message}</p>
    <div className="transaction-steps">{transactionSteps.map((step, index) => {
      const pendingUnavailable = step === "Pending";
      const completed = !failed && ((state === "confirmed" && index <= 3) || (state === "submitting" && index < 1) || (state === "preparing" && index < 0));
      const current = !failed && ((state === "preparing" && index === 0) || (state === "submitting" && index === 1) || (state === "confirmed" && index === 3));
      return <div className={`transaction-step ${completed ? "completed" : ""} ${current ? "current" : ""} ${pendingUnavailable ? "unavailable" : ""}`} key={step}><span className="transaction-step-marker">{completed ? "✓" : index + 1}</span><span>{step}</span>{pendingUnavailable && <small>Not exposed</small>}</div>;
    })}</div>
    {failed && <div className="transaction-failure-note">The backend did not return a confirmed transaction. You can correct the form and try again.</div>}
  </section>;
}

export default function Issue() {
  const [form, setForm] = useState({ candidateName: "", rollNumber: "", course: "", grade: "", issueDate: "" });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [transactionState, setTransactionState] = useState("idle");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: "" }));
  }

  function validate() {
    const errors = {};
    const labels = { candidateName: "Candidate name", rollNumber: "Roll number", course: "Course or qualification", grade: "Grade / CGPA", issueDate: "Issue date" };
    Object.entries(form).forEach(([field, value]) => {
      if (!value.trim()) errors[field] = `${labels[field]} is required.`;
    });
    if (form.candidateName.trim() && form.candidateName.trim().length < 2) errors.candidateName = "Enter the candidate's full name.";
    if (form.course.trim() && form.course.trim().length < 2) errors.course = "Enter a course or qualification.";
    if (form.issueDate && Number.isNaN(Date.parse(form.issueDate))) errors.issueDate = "Enter a valid issue date.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);
    if (!validate()) return;
    setTransactionState("preparing");
    setLoading(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));
      await Promise.resolve();
      setTransactionState("submitting");
      const res = await api.post("/certificates/issue", payload);
      setTransactionState("confirmed");
      setResult(res.data);
    } catch (err) {
      setTransactionState("failed");
      setError(err.response?.data?.message || "The certificate could not be issued. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="page issue-page"><div className="page-header"><div><span className="eyebrow">Certificate registry</span><h1>Issue a certificate</h1><p className="lead">Create a tamper-evident credential anchored to the blockchain.</p></div><span className="badge badge-neutral">On-chain issuance</span></div>
    <div className="split-grid"><section className="card card-pad"><div className="form-header"><h3>Recipient details</h3><p className="muted small">Enter the information exactly as it should appear on the certificate.</p></div><form className="form" onSubmit={handleSubmit} noValidate>
      <Field label="Candidate name"><input className={`input ${fieldErrors.candidateName ? "input-error" : ""}`} placeholder="Full legal name" value={form.candidateName} onChange={(e) => update("candidateName", e.target.value)} aria-invalid={!!fieldErrors.candidateName} aria-describedby={fieldErrors.candidateName ? "candidateName-error" : undefined} />{fieldErrors.candidateName && <span id="candidateName-error" className="field-error">{fieldErrors.candidateName}</span>}</Field>
      <Field label="Roll number"><input className={`input ${fieldErrors.rollNumber ? "input-error" : ""}`} placeholder="Student or employee ID" value={form.rollNumber} onChange={(e) => update("rollNumber", e.target.value)} aria-invalid={!!fieldErrors.rollNumber} />{fieldErrors.rollNumber && <span className="field-error">{fieldErrors.rollNumber}</span>}</Field>
      <Field label="Course or qualification"><input className={`input ${fieldErrors.course ? "input-error" : ""}`} placeholder="e.g. B.Tech Computer Science" value={form.course} onChange={(e) => update("course", e.target.value)} aria-invalid={!!fieldErrors.course} />{fieldErrors.course && <span className="field-error">{fieldErrors.course}</span>}</Field>
      <div className="result-meta"><Field label="Grade / CGPA"><input className={`input ${fieldErrors.grade ? "input-error" : ""}`} placeholder="e.g. A+ or 8.7" value={form.grade} onChange={(e) => update("grade", e.target.value)} aria-invalid={!!fieldErrors.grade} />{fieldErrors.grade && <span className="field-error">{fieldErrors.grade}</span>}</Field><Field label="Issue date"><input className={`input ${fieldErrors.issueDate ? "input-error" : ""}`} type="date" value={form.issueDate} onChange={(e) => update("issueDate", e.target.value)} aria-invalid={!!fieldErrors.issueDate} />{fieldErrors.issueDate && <span className="field-error">{fieldErrors.issueDate}</span>}</Field></div>
      {error && <Alert>{error}</Alert>}<TransactionStatus state={transactionState} /><div className="form-actions"><Button type="submit" loading={loading}>{loading ? "Confirming on blockchain" : "Issue certificate"}</Button></div><p className="form-footnote">The transaction status updates from the existing backend response.</p>
    </form></section>
    <aside className="card card-pad"><span className="eyebrow">How it works</span><h3 style={{ marginTop: 8 }}>A permanent proof of authenticity</h3><p className="muted small" style={{ lineHeight: 1.65 }}>CertChain creates a unique fingerprint for this certificate and records it on the blockchain. Anyone with the certificate ID can verify it later.</p></aside></div>
    {result && <section className="card card-pad result-card issuance-confirmation" style={{ marginTop: 22 }}><div className="confirmation-heading"><div className="confirmation-icon">✓</div><div><span className="eyebrow">Issuance complete</span><h2>Certificate is ready</h2><p className="lead">The record was submitted successfully and can now be verified.</p></div><span className="badge badge-success">Confirmed</span></div><div className="result-meta"><div><span className="meta-label">Certificate ID</span><strong className="meta-value">{result.certificate.certId}</strong></div><div><span className="meta-label">Transaction hash</span><span className="mono">{result.certificate.txHash}</span></div><div><span className="meta-label">Blockchain confirmation</span><span className="meta-value"><span className="status-dot" /> Confirmed on chain</span></div><div className="qr-panel"><span className="meta-label">Verification QR</span><img src={result.qrDataUrl} alt="Verification QR code" /></div></div><div className="confirmation-actions"><Button variant="secondary" onClick={() => { setResult(null); setError(""); setTransactionState("idle"); setForm({ candidateName: "", rollNumber: "", course: "", grade: "", issueDate: "" }); }}>Issue another</Button><Link className="button button-secondary" to={`/certificates/${encodeURIComponent(result.certificate.certId)}`}>View certificate details</Link><a className="button button-primary" href={result.verifyUrl}>Open verification link</a></div></section>}
  </div>;
}
