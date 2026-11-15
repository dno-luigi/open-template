// SHA-256 as hex, on WebCrypto. Used to hash visitor IPs before they are stored,
// and to name stored files after their own contents.
const encoder = new TextEncoder();

function toHex(digest) {
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
}

/** The same hash, over bytes that are not text: a PDF, an image, an upload. */
export async function sha256HexBytes(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return toHex(await crypto.subtle.digest("SHA-256", view));
}
