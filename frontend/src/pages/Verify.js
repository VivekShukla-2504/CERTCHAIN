import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import { Alert, Button } from "../components/UI";

export default function Verify() {
  const { certificateId } = useParams();
  const [certId, setCertId] = useState("");
  const [result, setResult] = useState(null);
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function verifyCertificate(value) {
    const normalizedId = value.trim().toUpperCase();
    if (!normalizedId) {
      setState("invalid-input");
      setError("Enter a certificate ID to continue.");
      return;
    }
    setError("");
    setResult(null);
    setState("loading");
    setLoading(true);
    try {
      const res = await api.post("/verify", { certId: normalizedId });
      setResult(res.data);
      setState(res.data.revoked ? "revoked" : res.data.verified ? "verified" : "invalid");
    } catch (err) {
      if (err.response?.status === 404) {
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
    verifyCertificate(normalizedId);
  }, [certificateId]);

  function handleSubmit(e) {
    e.preventDefault();
    verifyCertificate(certId);
  }

  const hasResult = ["verified", "invalid", "revoked"].includes(state);
  const heading = state === "verified" ? "Certificate verified" : state === "revoked" ? "Certificate revoked" : state === "invalid" ? "Certificate invalid" : state === "not-found" ? "Certificate not found" : state === "error" ? "Verification unavailable" : "Verify a certificate";
  const badgeLabel = state === "verified" ? "Authentic" : state === "revoked" ? "Revoked" : state === "invalid" ? "Invalid" : null;

  return <div className="page public-verify-page"><div className="verify-hero"><span className="eyebrow">Public verification</span><h1>{certificateId ? "Certificate verification" : "Verify a certificate"}</h1><p className="lead">Confirm that a credential was issued by the institution named on it and has not been altered.</p><form className="verify-form" onSubmit={handleSubmit}><input className="input" placeholder="Enter certificate ID, e.g. CERT-7F3A2C" value={certId} onChange={(e) => { setCertId(e.target.value); if (state !== "idle") setState("idle"); }} required /><Button type="submit" loading={loading}>{loading ? "Checking" : "Verify"}</Button></form></div>
    {state === "loading" && <div className="verification-loading card card-pad"><span className="verification-loader" /><div><h3>Checking certificate</h3><p>Comparing the certificate record with the blockchain.</p></div></div>}
    {state === "invalid-input" && <Alert>{error}</Alert>}
    {["not-found", "error"].includes(state) && <div className={`verification-state card card-pad ${state}`}><div className="verification-state-icon">{state === "not-found" ? "?" : "!"}</div><div><span className="eyebrow">{state === "not-found" ? "Not found" : "Verification error"}</span><h2>{heading}</h2><p>{error}</p><button className="text-action" onClick={() => { setState("idle"); setError(""); }}>Try another ID</button></div></div>}
    {hasResult && result && <div className={`verification-state card card-pad ${state}`}><div className="verification-state-icon">{state === "verified" ? "✓" : state === "revoked" ? "!" : "×"}</div><div className="verification-state-copy"><div className="verification-state-title"><div><span className="eyebrow">Verification result</span><h2>{heading}</h2></div><span className={`badge ${state === "verified" ? "badge-success" : state === "revoked" ? "badge-revoked" : "badge-neutral"}`}>{badgeLabel}</span></div><p>{result.message}</p>{result.institutionId && <div className="public-result-meta"><div><span className="meta-label">Institution</span><strong>{result.institutionId}</strong></div>{result.issuedAt && <div><span className="meta-label">Issued at</span><strong>{new Date(result.issuedAt).toLocaleString()}</strong></div>}</div>}<button className="text-action" onClick={() => { setState("idle"); setResult(null); setError(""); }}>Verify another certificate</button></div></div>}
    {state === "idle" && <div className="empty-state"><h3>Ready to verify</h3><p className="small">Enter the certificate ID printed on the credential to see its authenticity status.</p></div>}
  </div>;
}
