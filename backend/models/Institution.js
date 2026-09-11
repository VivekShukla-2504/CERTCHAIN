const mongoose = require("mongoose");

const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    institutionId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    walletAddress: { type: String, required: true },
    passwordResetOtpHash: { type: String },
    passwordResetExpiresAt: { type: Date },
    passwordResetAttempts: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Institution", institutionSchema);
