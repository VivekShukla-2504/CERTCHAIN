# CertChain — Setup Guide

Blockchain-Based Secure Academic Certificate Issuance and Verification System
JNU · Blockchain Technology · Nimmi Sahu, Vartika Yadav, Vivek Shukla

Real stack: React, Node.js/Express, MongoDB, Solidity smart contract (Hardhat), ethers.js, JWT auth, IPFS (optional).

You need **4 terminals open at once**. Do these in order.

## Prerequisites (install once)
- Node.js 18+ and npm — https://nodejs.org
- MongoDB running locally, OR a free MongoDB Atlas connection string
- (Optional) IPFS Desktop / IPFS daemon — only needed if you want file storage on IPFS. Everything else works without it.

## 1. Install dependencies

```bash
# from the project root
npm install

cd backend
npm install

cd ../frontend
npm install
```

## 2. Terminal 1 — start a local blockchain

```bash
# from project root
npx hardhat node
```

This starts a local Ethereum test network and prints 20 test accounts with
private keys and 10,000 test ETH each. **Copy the first account's private
key** — you'll paste it into `backend/.env` in step 4. Leave this terminal running.

## 3. Terminal 2 — compile and deploy the smart contract

```bash
# from project root, in a new terminal
npx hardhat compile
npm run deploy:local
```

This prints something like:
```
CertificateRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa
```
**Copy this address** — you'll paste it into `backend/.env` in the next step.

## 4. Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in:
- `MONGO_URI` — your local MongoDB URI (default `mongodb://127.0.0.1:27017/certchain` works if MongoDB is running locally)
- `JWT_SECRET` — any random long string
- `RPC_URL` — leave as `http://127.0.0.1:8545` (the Hardhat node from step 2)
- `PRIVATE_KEY` — the private key you copied in step 2
- `CONTRACT_ADDRESS` — the address you copied in step 3

### Staging signer model

For this free-tier staging setup, `PRIVATE_KEY` is held only by the backend
environment and is used by the platform wallet to sign blockchain transactions.
The institution wallet address collected during registration is identity
metadata only. Institutions do not provide private keys, and the application
does not claim that an institution wallet signed the transaction. The recorded
on-chain issuer is the platform signer address.

## 5. Terminal 3 — start the backend

```bash
cd backend
npm run dev
```

You should see `MongoDB connected` and `Server running on http://localhost:5000`.
Test it: open `http://localhost:5000/api/health` in a browser — should show `{"status":"ok"}`.

## 6. Terminal 4 — start the frontend

```bash
cd frontend
npm start
```

Opens `http://localhost:3000` in your browser automatically.

## 7. Demo flow for your viva

1. Go to **Institution login** → **Register your institution**. For "wallet address", paste any of the test account addresses printed by `npx hardhat node` in Terminal 1.
2. Log in.
3. Go to **Issue certificate**, fill the form, submit. This writes the SHA-256 hash to your local blockchain and shows you the transaction hash + a QR code.
4. Go to **Verify certificate**, paste the Certificate ID → shows "Verified & authentic".
5. To demonstrate tamper detection: manually edit a certificate's data in MongoDB (e.g. using MongoDB Compass, change the grade), then verify again — it will show hash mismatch, since the on-chain hash no longer matches the recomputed hash of the altered data.

## Project structure

```
certchain-full/
├── contracts/CertificateRegistry.sol   # on-chain hash registry
├── scripts/deploy.js                   # deployment script
├── hardhat.config.js
├── backend/
│   ├── server.js                       # Express entry point
│   ├── models/                         # MongoDB schemas
│   ├── routes/                         # auth, certificates, verify
│   ├── middleware/auth.js              # JWT check
│   └── utils/                          # hashing, blockchain, IPFS
└── frontend/
    └── src/
        ├── App.js                      # routes
        └── pages/                      # Login, Signup, Issue, Verify
```

## If something goes wrong

- **MongoDB connection error** → make sure `mongod` is runnning, or use a free MongoDB Atlas cluster and paste its connection string into `MONGO_URI`.
- **"insufficient funds" or contract errors** → make sure `npx hardhat node` (Terminal 1) is still running and you copied its private key/address correctly.
- **CORS errors in browser console** → make sure backend is running on port 5000 and frontend's `REACT_APP_API_URL` (in `frontend/.env` if you create one) points to `http://localhost:5000/api`
