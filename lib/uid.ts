// crypto.randomUUID() only exists in secure contexts (https:// or
// localhost). Testing over http://192.168.x.x on a phone is not
// secure, so it silently throws. This falls back to a
// non-cryptographic but perfectly fine UUID for local ids.
export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
