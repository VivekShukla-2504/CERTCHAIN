const express = require("express");
const Certificate = require("../models/Certificate");
const { hashCertificateData } = require("../utils/hash");
const { verifyOnChain } = require("../utils/blockchain");
const { readString } = require("../utils/validation");

const router = express.Router();

// POST /api/verify - public endpoint, anyone can check a certificate
// Body: either { certId } to verify what's on file, or the full candidate
// fields (as printed on a certificate) to check for tampering.
router.post("/", async (req, res) => {
  try {
    const { certId, candidateName, rollNumber, course, grade, issueDate } = req.body;
    const certIdError = readString(certId, "Certificate ID", { max: 80, pattern: /^[A-Za-z0-9_-]+$/ });
    if (certIdError) return res.status(400).json({ message: certIdError });

    const stored = await Certificate.findOne({ certId });
    if (!stored) {
      return res.status(404).json({ verified: false, message: "No certificate found with this ID" });
    }

    // Use submitted fields if provided (simulates re-checking a printed/uploaded
    // certificate); otherwise fall back to what's on file, for a basic on-chain check.
    const dataToCheck = {
      candidateName: candidateName ?? stored.candidateName,
      rollNumber: rollNumber ?? stored.rollNumber,
      course: course ?? stored.course,
      grade: grade ?? stored.grade,
      issueDate: issueDate ?? stored.issueDate,
      institutionId: stored.institutionId
    };

    const recomputedHash = hashCertificateData(dataToCheck);
    const chainResult = await verifyOnChain(certId, recomputedHash);

    res.json({
      verified: chainResult.isValid,
      revoked: chainResult.revoked,
      institutionId: chainResult.institutionId,
      issuedAt: chainResult.issuedAt ? new Date(chainResult.issuedAt * 1000).toISOString() : null,
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
