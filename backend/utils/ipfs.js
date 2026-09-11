const { create } = require("kubo-rpc-client");
require("dotenv").config();

// Requires a local IPFS daemon (`ipfs daemon`) or a remote pinning service URL.
// If you don't want to set up IPFS tonight, the routes that call this are
// optional — certificates still work using only the on-chain hash.
const ipfs = create({ url: process.env.IPFS_API_URL || "http://127.0.0.1:5001" });

async function uploadToIPFS(buffer) {
  const result = await ipfs.add(buffer);
  return result.cid.toString();
}

module.exports = { uploadToIPFS };
