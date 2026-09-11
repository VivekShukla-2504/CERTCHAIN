const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");
const Certificate = require("../models/Certificate");
const { requireAuth } = require("../middleware/auth");
const { hashCertificateData } = require("../utils/hash");
const { issueOnChain, getRecordOnChain, getPlatformSignerAddress, revokeOnChain } = require("../utils/blockchain");
const { validateCertificateInput } = require("../utils/validation");

const router = express.Router();

function generateCertId() {
  return "CERT-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function responseForCertificate(certificate) {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) throw new Error("FRONTEND_URL is required to generate certificate verification URLs");
  const verifyUrl = `${frontendUrl.replace(/\/$/, "")}/verify/${certificate.certId}`;
  return QRCode.toDataURL(verifyUrl).then((qrDataUrl) => ({
    message: certificate.status === "confirmed" ? "Certificate issued" : "Certificate issuance is being reconciled",
    certificate,
    qrDataUrl,
    verifyUrl
  }));
}

// POST /api/certificates/issue  (institution must be logged in)
router.post("/issue", requireAuth, async (req, res) => {
  let certificate;
  let chainConfirmed = false;
  try {
    const { candidateName, rollNumber, course, grade, issueDate } = req.body;
    const validationError = validateCertificateInput(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const normalized = { candidateName: candidateName.trim(), rollNumber: rollNumber.trim(), course: course.trim(), grade: grade.trim(), issueDate: issueDate.trim() };
    const institutionId = req.institution.institutionId;
    const certHash = hashCertificateData({
      ...normalized,
      institutionId
    });

    const requestedKey = req.get("Idempotency-Key") || req.body.idempotencyKey;
    const idempotencyKey = typeof requestedKey === "string" && requestedKey.trim()
      ? requestedKey.trim().slice(0, 128)
      : crypto.createHash("sha256").update(JSON.stringify({ institutionId, normalized })).digest("hex");
    certificate = await Certificate.findOneAndUpdate(
      { idempotencyKey },
      {
        $setOnInsert: {
          certId: generateCertId(),
          ...normalized,
          institutionId,
          // The institution wallet is identity metadata only. The platform
          // wallet is the actual transaction signer for staging/Sepolia.
          issuerWallet: getPlatformSignerAddress(),
          certHash,
          idempotencyKey,
          status: "pending"
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (certificate.institutionId !== institutionId || certificate.certHash !== certHash) {
      return res.status(409).json({ message: "Idempotency key is already associated with another certificate" });
    }

    if (certificate.status === "confirmed") {
      return res.status(200).json(await responseForCertificate(certificate));
    }

    if (["pending", "submitted", "failed"].includes(certificate.status)) {
      const onChain = await getRecordOnChain(certificate.certId);
      if (onChain.issuedAt > 0) {
        if (onChain.certHash.toLowerCase() !== `0x${certHash}`.toLowerCase()) {
          return res.status(409).json({ message: "On-chain certificate does not match this request" });
        }
        certificate.status = "confirmed";
        certificate.revoked = onChain.revoked;
        await certificate.save();
        return res.status(200).json(await responseForCertificate(certificate));
      }
      if (certificate.status === "submitted") {
        return res.status(202).json({ message: "Certificate issuance is still being reconciled", certificate });
      }
    }

    const claimed = await Certificate.findOneAndUpdate(
      { _id: certificate._id, status: { $in: ["pending", "failed"] } },
      { $set: { status: "submitted" } },
      { new: true }
    );
    if (!claimed) {
      return res.status(202).json({ message: "Certificate issuance is already in progress", certificate });
    }
    certificate = claimed;

    // Write the hash to the blockchain - this is the step that makes it tamper-evident
    const txHash = await issueOnChain(certificate.certId, certHash, institutionId);
    chainConfirmed = true;
    certificate.txHash = txHash;
    certificate.status = "confirmed";
    await certificate.save();
    res.status(201).json(await responseForCertificate(certificate));
  } catch (err) {
    if (certificate && !chainConfirmed) {
      await Certificate.updateOne({ _id: certificate._id }, { $set: { status: "failed" } }).catch(() => {});
    }
    res.status(500).json({ message: "Issuance failed" });
  }
});

// GET /api/certificates - dashboard data for the authenticated institution
router.get("/", requireAuth, async (req, res) => {
  try {
    const filter = { institutionId: req.institution.institutionId };
    const isListRequest = req.query.view === "list";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const status = req.query.status === "revoked" || req.query.status === "active" ? req.query.status : "all";
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || (isListRequest ? 20 : 10), 1), 100);

    if (search) {
      const expression = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ certId: expression }, { candidateName: expression }, { course: expression }];
    }
    if (status === "revoked") filter.revoked = true;
    if (status === "active") filter.revoked = { $ne: true };

    const [certificates, total, revoked] = await Promise.all([
      Certificate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Certificate.countDocuments({ institutionId: req.institution.institutionId }),
      Certificate.countDocuments({ institutionId: req.institution.institutionId, revoked: true })
    ]);

    const matching = await Certificate.countDocuments(filter);

    res.json({
      stats: {
        total,
        verified: total - revoked,
        revoked,
        pending: null
      },
      certificates,
      pendingAvailable: false,
      pagination: {
        page,
        limit,
        total: matching,
        pages: Math.ceil(matching / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: "Dashboard data unavailable" });
  }
});

// GET /api/certificates/:certId - fetch stored metadata (for the issuing dashboard)
router.get("/:certId", requireAuth, async (req, res) => {
  try {
    const cert = await Certificate.findOne({
      certId: req.params.certId,
      institutionId: req.institution.institutionId
    });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    res.json(cert);
  } catch (err) {
    res.status(500).json({ message: "Certificate details unavailable" });
  }
});

// POST /api/certificates/:certId/revoke
router.post("/:certId/revoke", requireAuth, async (req, res) => {
  try {
    const cert = await Certificate.findOne({
      certId: req.params.certId,
      institutionId: req.institution.institutionId
    });
    if (!cert) return res.status(404).json({ message: "Certificate not found" });
    await revokeOnChain(cert.certId);
    cert.revoked = true;
    await cert.save();
    res.json({ message: "Certificate revoked" });
  } catch (err) {
    res.status(500).json({ message: "Revocation failed" });
  }
});

module.exports = router;
