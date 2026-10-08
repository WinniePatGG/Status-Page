/**
 * Password hashing based on node:crypto scrypt.
 *
 * scrypt is memory hard and ships with Node itself, so no native dependency is
 * needed. Stored format: `scrypt$N$r$p$saltHex$hashHex`.
 */

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const ALGORITHM = "scrypt";
const COST = 16384; // N
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p
const KEY_LENGTH = 64;

/** Promise wrapper around `crypto.scrypt`. */
function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  });

  return [
    ALGORITHM,
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");

  if (parts.length !== 6 || parts[0] !== ALGORITHM) {
    return false;
  }

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelism = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];

  if (
    !Number.isInteger(cost) ||
    !Number.isInteger(blockSize) ||
    !Number.isInteger(parallelism) ||
    !saltHex ||
    !hashHex
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(hashHex, "hex");
    const derived = await deriveKey(
      password,
      Buffer.from(saltHex, "hex"),
      expected.length,
      {
        N: cost,
        r: blockSize,
        p: parallelism,
      },
    );

    return (
      derived.length === expected.length && timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}

/** 32 byte session token, returned as hex. */
export function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Session tokens are stored as a SHA-256 hash, so a database leak does not
 * hand out valid sessions.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
