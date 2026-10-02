const express = require("express");
const Certificate = require("../models/Certificate");
const Institution = require("../models/Institution");
const { hashCertificateData, hashFileBuffer } = require("../utils/hash");
const { verifyOnChain } = require("../utils/blockchain");
const { receivePdf, isPdfBuffer } = require("../utils/pdfUpload");
const { DEFAULT_PUBLIC_CERTIFICATE_FIELDS } = require("../utils/disclosure");
const { readString, validateCertificateInput } = require("../utils/validation");

const router = express.Router();
const CERTIFICATE_FIELDS = ["candidateName", "rollNumber", "documentType", "course", "grade", "issueDate"];

async function getPublicFields(institutionId) {
  try {
    const institution = await Institution.findOne({ institutionId }).select("publicVerificationFields").lean();
    return institution?.publicVerificationFields || DEFAULT_PUBLIC_CERTIFICATE_FIELDS;
  } catch {
    return DEFAULT_PUBLIC_CERTIFICATE_FIELDS;
  }
}

function discloseCertificate(fields, publicFields) {
  return Object.fromEntries(CERTIFICATE_FIELDS
    .filter((field) => publicFields.includes(field) && fields[field] !== undefined)
    .map((field) => [field, fields[field]]));
}

// POST /api/verify - public endpoint, anyone can check a certificate
// Body: either { certId } to verify what's on file, or the full candidate
// fields (as printed on a certificate) to check for tampering.
router.post("/", receivePdf, async (req, res) => {
  try {
    const { certId, candidateName, rollNumber, course, grade, issueDate, institutionId, documentType } = req.body;
    const certIdError = readString(certId, "Certificate ID", { max: 80, pattern: /^[A-Za-z0-9_-]+$/ });
    if (certIdError) return res.status(400).json({ message: certIdError });

    let fieldsToDisclose;
    let chainResult;
    if (req.file) {
      if (!isPdfBuffer(req.file.buffer)) {
        return res.status(400).json({ message: "Upload a valid PDF certificate" });
      }
      const validationError = validateCertificateInput(req.body);
      if (validationError) return res.status(400).json({ message: validationError });
      const institutionError = readString(institutionId, "Institution ID", { max: 100 });
      if (institutionError) return res.status(400).json({ message: institutionError });
      const allowedDocumentTypes = ["Degree", "Marksheet", "Transcript", "Diploma", "Other"];
      if (documentType && !allowedDocumentTypes.includes(documentType)) {
        return res.status(400).json({ message: "Choose a valid document type" });
      }
      fieldsToDisclose = {
        candidateName: candidateName.trim(),
        rollNumber: rollNumber.trim(),
        documentType: documentType || "Other",
        course: course.trim(),
        grade: grade.trim(),
        issueDate: issueDate.trim()
      };
      const commitmentFields = {
        candidateName: fieldsToDisclose.candidateName,
        rollNumber: fieldsToDisclose.rollNumber,
        course: fieldsToDisclose.course,
        grade: fieldsToDisclose.grade,
        issueDate: fieldsToDisclose.issueDate,
        institutionId: institutionId.trim(),
        documentHash: hashFileBuffer(req.file.buffer)
      };
      if (documentType) commitmentFields.documentType = documentType;
      chainResult = await verifyOnChain(certId, hashCertificateData(commitmentFields));
      if (!chainResult.isValid && !chainResult.revoked && documentType) {
        chainResult = await verifyOnChain(certId, hashCertificateData({
          candidateName: commitmentFields.candidateName,
          rollNumber: commitmentFields.rollNumber,
          course: commitmentFields.course,
          grade: commitmentFields.grade,
          issueDate: commitmentFields.issueDate,
          institutionId: commitmentFields.institutionId,
          documentHash: commitmentFields.documentHash
        }));
      }
    } else {
      const stored = await Certificate.findOne({ certId });
      if (!stored) {
        return res.status(404).json({ verified: false, message: "No certificate found with this ID" });
      }
      if (stored.documentHash) {
        return res.status(400).json({ documentRequired: true, message: "Upload the certificate PDF and enter the printed details to verify it" });
      }
      fieldsToDisclose = {
        candidateName: candidateName ?? stored.candidateName,
        rollNumber: rollNumber ?? stored.rollNumber,
        documentType: stored.documentType || "Other",
        course: course ?? stored.course,
        grade: grade ?? stored.grade,
        issueDate: issueDate ?? stored.issueDate
      };
      const legacyHashFields = {
        candidateName: fieldsToDisclose.candidateName,
        rollNumber: fieldsToDisclose.rollNumber,
        course: fieldsToDisclose.course,
        grade: fieldsToDisclose.grade,
        issueDate: fieldsToDisclose.issueDate,
        institutionId: stored.institutionId
      };
      if (stored.documentType) legacyHashFields.documentType = stored.documentType;
      const recomputedHash = hashCertificateData(legacyHashFields);
      chainResult = await verifyOnChain(certId, recomputedHash);
    }

    const publicFields = chainResult.isValid
      ? await getPublicFields(chainResult.institutionId)
      : [];

    res.json({
      verified: chainResult.isValid,
      revoked: chainResult.revoked,
      institutionId: chainResult.institutionId,
      issuedAt: chainResult.issuedAt ? new Date(chainResult.issuedAt * 1000).toISOString() : null,
      certificate: chainResult.isValid ? discloseCertificate(fieldsToDisclose, publicFields) : null,
      message: chainResult.revoked
        ? "This certificate has been revoked by the issuing institution."
        : chainResult.isValid
        ? "Certificate is authentic and matches the blockchain record."
        : "Hash mismatch - this certificate has been altered or is not genuine."
    });
  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});
module.exports = router;
