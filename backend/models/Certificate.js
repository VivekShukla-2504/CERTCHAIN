const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    certId: { type: String, required: true, unique: true },
    candidateName: { type: String, required: true },
    rollNumber: { type: String, required: true },
    course: { type: String, required: true },
    grade: { type: String, required: true },
    issueDate: { type: Date, required: true },
    institutionId: { type: String, required: true },
    issuerWallet: { type: String, required: true },
    certHash: { type: String, required: true }, // SHA-256 hex digest
    ipfsCid: { type: String }, // optional pointer to the stored PDF on IPFS
    txHash: { type: String }, // blockchain transaction hash, available after submission
    status: { type: String, enum: ["pending", "submitted", "confirmed", "failed"], default: "pending", index: true },
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    revoked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certificateSchema);
