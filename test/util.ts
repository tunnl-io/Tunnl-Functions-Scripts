import crypto from "crypto";

function encryptData(data: string, encryptionKey: string): string {
  const key = Buffer.from(encryptionKey, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encryptedData = cipher.update(data, "utf8", "hex");
  encryptedData += cipher.final("hex");
  return iv.toString("hex") + encryptedData;
}

function decryptData(encryptedData: string, encryptionKey: string): string {
  const key = Buffer.from(encryptionKey, "hex");
  const iv = Buffer.from(encryptedData.slice(0, 32), "hex");
  const data = encryptedData.slice(32);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decryptedData = decipher.update(data, "hex", "utf8");
  decryptedData += decipher.final("utf8");
  return decryptedData;
}

function generateEncryptionKey(): string {
  const length = 32; // 256 bits (32 bytes) for AES-256
  const key = crypto.randomBytes(length);
  return key.toString("hex");
}

async function sha256(text: string): Promise<string> {
  const data = Buffer.from(text, "utf8");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export { encryptData, decryptData, generateEncryptionKey, sha256 };