const { ethers } = require("ethers");
require("dotenv").config();

// Minimal ABI - only the functions/events this backend calls
const CONTRACT_ABI = [
  "function issueCertificate(string certId, bytes32 certHash, string institutionId) external",
  "function revokeCertificate(string certId) external",
  "function verifyCertificate(string certId, bytes32 certHash) external view returns (bool isValid, address issuer, string institutionId, uint256 issuedAt, bool revoked)",
  "function getRecord(string certId) external view returns (tuple(bytes32 certHash, address issuer, string institutionId, uint256 issuedAt, bool revoked))",
  "event CertificateIssued(string indexed certId, bytes32 certHash, address indexed issuer, uint256 issuedAt)"
];

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
// The platform wallet is the current staging/Sepolia transaction signer.
// Institution wallet addresses are identity metadata only; their private keys
// are never accepted or stored by this backend.
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

/** Converts a hex SHA-256 digest string into a bytes32 value for Solidity */
function toBytes32(hexHash) {
  return "0x" + hexHash;
}

/** Returns the public address of the backend-controlled platform signer. */
function getPlatformSignerAddress() {
  return wallet.address;
}

/** Submits a new certificate hash to the smart contract */
async function issueOnChain(certId, certHashHex, institutionId) {
  const tx = await contract.issueCertificate(certId, toBytes32(certHashHex), institutionId);
  const receipt = await tx.wait();
  return receipt.hash; // transaction hash
}

/** Reads back a certificate record and checks the hash against it */
async function verifyOnChain(certId, certHashHex) {
  const [isValid, issuer, institutionId, issuedAt, revoked] = await contract.verifyCertificate(
    certId,
    toBytes32(certHashHex)
  );
  return {
    isValid,
    issuer,
    institutionId,
    issuedAt: Number(issuedAt),
    revoked
  };
}

async function getRecordOnChain(certId) {
  const [certHash, issuer, institutionId, issuedAt, revoked] = await contract.getRecord(certId);
  return { certHash, issuer, institutionId, issuedAt: Number(issuedAt), revoked };
}

async function revokeOnChain(certId) {
  const tx = await contract.revokeCertificate(certId);
  const receipt = await tx.wait();
  return receipt.hash;
}

module.exports = { issueOnChain, verifyOnChain, getRecordOnChain, getPlatformSignerAddress, revokeOnChain };
