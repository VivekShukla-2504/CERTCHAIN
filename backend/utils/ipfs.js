require("dotenv").config();

// Requires a local IPFS daemon (`ipfs daemon`) or a remote pinning service URL.
// If you don't want to set up IPFS tonight, the routes that call this are
// optional — certificates still work using only the on-chain hash.
let ipfsClient;

function isIPFSEnabled() {
  return process.env.IPFS_ENABLED === "true";
}

async function uploadToIPFS(buffer) {
  if (!ipfsClient) {
    const { create } = await import("kubo-rpc-client");
    ipfsClient = create({
      url: process.env.IPFS_API_URL || "http://127.0.0.1:5001",
      headers: { Origin: process.env.IPFS_ORIGIN || "http://localhost:3000" }
    });
  }
  const result = await ipfsClient.add(buffer, { pin: true });
  return result.cid.toString();
}

module.exports = { isIPFSEnabled, uploadToIPFS };
