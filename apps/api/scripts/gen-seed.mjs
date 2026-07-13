/**
 * Generate seed.sql with a real PBKDF2 hash for password "demo1234".
 * Usage: node scripts/gen-seed.mjs
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const password = "demo1234";

// Fixed salt for reproducible seed
const salt = Uint8Array.from([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
]);

const baseKey = await webcrypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits"],
);
const bits = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
  baseKey,
  256,
);

const saltB64 = Buffer.from(salt).toString("base64");
const hashB64 = Buffer.from(bits).toString("base64");
const stored = `pbkdf2$100000$${saltB64}$${hashB64}`;

const template = readFileSync(resolve(__dirname, "../seed.template.sql"), "utf8");
const out = template.replaceAll("__DEMO_PASSWORD_HASH__", stored);
writeFileSync(resolve(__dirname, "../seed.sql"), out);
console.log("Wrote seed.sql");
console.log("login_id=demo password=demo1234");
console.log("hash=", stored);
