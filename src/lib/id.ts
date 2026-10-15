import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyz";
const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no 0/O, 1/I

function encode(bytes: Uint8Array, alphabet: string, length: number) {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Prefixed random id, e.g. `lst_8f3k2m9q0z1x4c7v`. */
export function newId(prefix: string, length = 18) {
  return `${prefix}_${encode(randomBytes(length), ALPHABET, length)}`;
}

/** Booking reference shown to people, e.g. `K7Q-4MZ2`. Unambiguous characters only. */
export function newReference() {
  const s = encode(randomBytes(7), REF_ALPHABET, 7);
  return `${s.slice(0, 3)}-${s.slice(3)}`;
}

/** Long secret for links in emails. */
export function newToken() {
  return randomBytes(24).toString("base64url");
}
