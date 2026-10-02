import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

export default function Verify() {
  const { certificateId } = useParams();
  const [certId, setCertId] = useState("");
  const [certificateFields, setCertificateFields] = useState({
    candidateName: "",
    rollNumber: "",
    institutionId: "",
    documentType: "Degree",
    course: "",
    grade: "",
    issueDate: ""
  });
  const [documentFile, setDocumentFile] = useState(null);
  const [result, setResult] = useState(null);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verifyCertificate(value, selectedFile = documentFile) {
    const normalizedId = value.trim().toUpperCase();
    if (!normalizedId) {
      setState("invalid-input");
      setError("Enter a certificate ID to continue.");
      return;
    }
    if (selectedFile && Object.entries(certificateFields).some(([field, fieldValue]) => field !== "documentType" && !fieldValue.trim())) {
      setState("invalid-input");
      setError("Enter all details exactly as printed on the certificate.");
      return;
    }
    setError("");
    setResult(null);
    setState("loading");
    setLoading(true);
    try {
      const payload = new FormData();
      payload.append("certId", normalizedId);
      if (selectedFile) payload.append("document", selectedFile);
      if (selectedFile) Object.entries(certificateFields).forEach(([field, fieldValue]) => payload.append(field, fieldValue.trim()));
      const res = await api.post("/verify", payload);
      setResult(res.data);
      setState(res.data.revoked ? "revoked" : res.data.verified ? "verified" : "invalid");
    } catch (err) {
      if (err.response?.data?.documentRequired) {
        setState("document-required");
        setError(err.response.data.message);
      } else if (err.response?.status === 404) {
        setState("not-found");
        setError("No certificate was found with this ID.");
      } else {
        setState("error");
        setError(err.response?.data?.message || "The verification service could not be reached.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!certificateId) return;
    const normalizedId = decodeURIComponent(certificateId).trim().toUpperCase();
    setCertId(normalizedId);
    verifyCertificate(normalizedId, null);
  }, [certificateId]);

  function handleSubmit(e) {
    e.preventDefault();
    verifyCertificate(certId);
  }

  const hasResult = ["verified", "invalid", "revoked"].includes(state);
  const heading = state === "verified" ? "Certificate verified" : state === "revoked" ? "Certificate revoked" : state === "invalid" ? "Certificate invalid" : state === "not-found" ? "Certificate not found" : state === "document-required" ? "Upload the original PDF" : state === "error" ? "Verification unavailable" : "Verify a certificate";
  const badgeLabel = state === "verified" ? "Authentic" : state === "revoked" ? "Revoked" : state === "invalid" ? "Invalid" : null;

  return <div className="page public-verify-page"><div className="verify-hero"><span className="eyebrow">Public verification</span><h1>{certificateId ? "Certificate verification" : "Verify a certificate"}</h1><p className="lead">Check the original PDF and the details printed on it against the institution's on-chain record.</p><form className="verify-form verify-form-stacked" onSubmit={handleSubmit}><div className="verify-entry-row"><input className="input" placeholder="Certificate ID" value={certId} onChange={(e) => { setCertId(e.target.value); if (state !== "idle") setState("idle"); }} required /><input className="input" type="file" accept="application/pdf,.pdf" aria-label="Certificate PDF" onChange={(e) => { setDocumentFile(e.target.files?.[0] || null); setState("idle"); setError(""); setResult(null); }} /></div><div className="verify-fields"><label className="field"><span>Student name</span><input className="input" value={certificateFields.candidateName} onChange={(e) => setCertificateFields((current) => ({ ...current, candidateName: e.target.value }))} /></label><label className="field"><span>Roll number</span><input className="input" value={certificateFields.rollNumber} onChange={(e) => setCertificateFields((current) => ({ ...current, rollNumber: e.target.value }))} /></label><label className="field"><span>Institution ID</span><input className="input" value={certificateFields.institutionId} onChange={(e) => setCertificateFields((current) => ({ ...current, institutionId: e.target.value }))} /></label><label className="field"><span>Document type</span><select className="select" value={certificateFields.documentType} onChange={(e) => setCertificateFields((current) => ({ ...current, documentType: e.target.value }))}><option>Degree</option><option>Marksheet</option><option>Transcript</option><option>Diploma</option><option>Other</option></select></label><label className="field"><span>Course / qualification</span><input className="input" value={certificateFields.course} onChange={(e) => setCertificateFields((current) => ({ ...current, course: e.target.value }))} /></label><label className="field"><span>Grade / CGPA</span><input className="input" value={certificateFields.grade} onChange={(e) => setCertificateFields((current) => ({ ...current, grade: e.target.value }))} /></label><label className="field"><span>Issue date</span><input className="input" type="date" value={certificateFields.issueDate} onChange={(e) => setCertificateFields((current) => ({ ...current, issueDate: e.target.value }))} /></label></div><Button type="submit" loading={loading}>{loading ? "Checking document" : "Verify certificate"}</Button></form></div>
    {state === "loading" && <div className="verification-loading card card-pad"><span className="verification-loader" /><div><h3>Checking certificate</h3><p>Comparing the certificate record with the blockchain.</p></div></div>}
    {state === "invalid-input" && <Alert>{error}</Alert>}
    {["not-found", "error", "document-required"].includes(state) && <div className={`verification-state card card-pad ${state}`}><div className="verification-state-icon">{state === "not-found" ? "?" : "!"}</div><div><span className="eyebrow">{state === "not-found" ? "Not found" : state === "document-required" ? "PDF required" : "Verification error"}</span><h2>{heading}</h2><p>{error}</p><button className="text-action" onClick={() => { setState("idle"); setError(""); }}>Try again</button></div></div>}
    {hasResult && result && <div className={`verification-state card card-pad ${state}`}><div className="verification-state-icon">{state === "verified" ? "✓" : state === "revoked" ? "!" : "×"}</div><div className="verification-state-copy"><div className="verification-state-title"><div><span className="eyebrow">Verification result</span><h2>{heading}</h2></div><span className={`badge ${state === "verified" ? "badge-success" : state === "revoked" ? "badge-revoked" : "badge-neutral"}`}>{badgeLabel}</span></div><p>{result.message}</p>{result.certificate && <><h3>Certificate details</h3><div className="public-result-meta"><div><span className="meta-label">Certificate holder</span><strong>{result.certificate.candidateName}</strong></div><div><span className="meta-label">Roll number</span><strong>{result.certificate.rollNumber}</strong></div><div><span className="meta-label">Document type</span><strong>{result.certificate.documentType}</strong></div><div><span className="meta-label">Course</span><strong>{result.certificate.course}</strong></div><div><span className="meta-label">Grade</span><strong>{result.certificate.grade}</strong></div><div><span className="meta-label">Certificate issue date</span><strong>{new Date(result.certificate.issueDate).toLocaleDateString()}</strong></div></div></>}{result.institutionId && <div className="public-result-meta"><div><span className="meta-label">Institution</span><strong>{result.institutionId}</strong></div>{result.issuedAt && <div><span className="meta-label">On-chain issue time</span><strong>{new Date(result.issuedAt).toLocaleString()}</strong></div>}</div>}<button className="text-action" onClick={() => { setState("idle"); setResult(null); setError(""); }}>Verify another certificate</button></div></div>}
    {state === "idle" && <div className="empty-state"><h3>Ready to verify</h3><p className="small">Enter the certificate ID printed on the credential to see its authenticity status.</p></div>}
  </div>;
}
