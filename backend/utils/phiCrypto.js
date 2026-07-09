const { encrypt, decrypt } = require('../middleware/encryption');

function requireEncryptionKey() {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable must be set');
  }
}

// Encrypts a single scalar value (string/number) for storage in a TEXT column.
function encryptField(value) {
  if (value === null || value === undefined) return null;
  requireEncryptionKey();
  return encrypt(String(value));
}

// Decrypts a value produced by encryptField. Returns null for null/empty ciphertext
// rather than throwing, so reading legacy/blank rows doesn't crash a route.
function decryptField(ciphertext) {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') return null;
  requireEncryptionKey();
  try {
    return decrypt(ciphertext);
  } catch (error) {
    return null;
  }
}

// Encrypts an object/array as ciphertext-wrapped JSON for storage in a TEXT column.
function encryptJSON(value) {
  if (value === null || value === undefined) return null;
  return encryptField(JSON.stringify(value));
}

// Decrypts and parses JSON produced by encryptJSON. Returns null on any failure
// (missing/blank ciphertext, corrupt data) instead of throwing.
function decryptJSON(ciphertext) {
  const plain = decryptField(ciphertext);
  if (plain === null || plain === undefined || plain === '') return null;
  try {
    return JSON.parse(plain);
  } catch (error) {
    return null;
  }
}

module.exports = { encryptField, decryptField, encryptJSON, decryptJSON };
