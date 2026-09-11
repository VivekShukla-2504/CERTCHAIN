// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CertificateRegistry
/// @notice Stores certificate hashes on-chain for tamper-proof verification.
/// Only the raw SHA-256 hash + minimal metadata is stored — never personal data.
contract CertificateRegistry {
    uint256 private constant MAX_CERT_ID_LENGTH = 100;
    uint256 private constant MAX_INSTITUTION_ID_LENGTH = 100;

    struct CertRecord {
        bytes32 certHash;      // SHA-256 hash of the certificate document/data
        address issuer;        // wallet address of the issuing institution
        string institutionId;  // human-readable institution identifier
        uint256 issuedAt;      // block timestamp of issuance
        bool revoked;          // allows an institution to revoke a wrongly-issued cert
    }

    // certId (e.g. "CERT-7F3A2C") => record
    mapping(string => CertRecord) private records;

    // institution wallet => allowed to issue
    mapping(address => bool) public authorizedIssuers;

    address public owner;
    address public pendingOwner;

    event CertificateIssued(string indexed certId, bytes32 certHash, address indexed issuer, uint256 issuedAt);
    event CertificateRevoked(string indexed certId, address indexed revokedBy);
    event IssuerAuthorized(address indexed issuer, string institutionId);
    event IssuerRevoked(address indexed issuer);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true; // deployer is authorized by default
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Starts a two-step ownership transfer. The recipient must accept it.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Completes a pending ownership transfer by the nominated owner.
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not pending owner");
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    /// @notice Owner grants an institution wallet permission to issue certificates
    function authorizeIssuer(address issuer, string calldata institutionId) external onlyOwner {
        require(issuer != address(0), "Issuer cannot be zero address");
        require(bytes(institutionId).length > 0, "Institution ID cannot be empty");
        require(bytes(institutionId).length <= MAX_INSTITUTION_ID_LENGTH, "Institution ID too long");
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer, institutionId);
    }

    /// @notice Revoke an institution's issuing rights
    function revokeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Issuer cannot be zero address");
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    /// @notice Issue a certificate by storing its hash on-chain
    /// @param certId unique certificate identifier generated off-chain
    /// @param certHash SHA-256 hash of the certificate document
    /// @param institutionId identifier of the issuing institution
    function issueCertificate(
        string calldata certId,
        bytes32 certHash,
        string calldata institutionId
    ) external onlyAuthorized {
        require(bytes(certId).length > 0, "Certificate ID cannot be empty");
        require(bytes(certId).length <= MAX_CERT_ID_LENGTH, "Certificate ID too long");
        require(bytes(institutionId).length > 0, "Institution ID cannot be empty");
        require(bytes(institutionId).length <= MAX_INSTITUTION_ID_LENGTH, "Institution ID too long");
        require(records[certId].issuedAt == 0, "Certificate ID already exists");
        require(certHash != bytes32(0), "Hash cannot be empty");

        records[certId] = CertRecord({
            certHash: certHash,
            issuer: msg.sender,
            institutionId: institutionId,
            issuedAt: block.timestamp,
            revoked: false
        });

        emit CertificateIssued(certId, certHash, msg.sender, block.timestamp);
    }

    /// @notice Revoke a previously issued certificate (e.g. issued in error)
    function revokeCertificate(string calldata certId) external {
        CertRecord storage rec = records[certId];
        require(rec.issuedAt != 0, "Certificate does not exist");
        require(rec.issuer == msg.sender || msg.sender == owner, "Not authorized to revoke");
        require(!rec.revoked, "Certificate already revoked");
        rec.revoked = true;
        emit CertificateRevoked(certId, msg.sender);
    }

    /// @notice Verify a certificate by comparing a freshly computed hash against the stored one
    /// @return isValid true if hash matches and certificate is not revoked
    /// @return issuer the wallet address that issued it
    /// @return institutionId the issuing institution
    /// @return issuedAt timestamp of issuance
    /// @return revoked whether the certificate has been revoked
    function verifyCertificate(string calldata certId, bytes32 certHash)
        external
        view
        returns (bool isValid, address issuer, string memory institutionId, uint256 issuedAt, bool revoked)
    {
        CertRecord memory rec = records[certId];
        bool exists = rec.issuedAt != 0;
        bool matches = exists && rec.certHash == certHash && !rec.revoked;
        return (matches, rec.issuer, rec.institutionId, rec.issuedAt, rec.revoked);
    }

    /// @notice Fetch raw record (for admin/debug use)
    function getRecord(string calldata certId) external view returns (CertRecord memory) {
        return records[certId];
    }
}
