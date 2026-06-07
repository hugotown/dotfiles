// Soft-truncate a UTF-8 buffer to maxKb bytes. Slices on a byte boundary then
// trims any trailing partial multi-byte sequence by re-decoding tolerantly.
// Curl's --max-filesize is the HARD cap (2x maxKb) and stops the transfer; this
// function only handles the residual.
export interface TruncateResult {
  text: string;
  truncated: boolean;
}

export function softTruncate(buf: Buffer, maxKb: number): TruncateResult {
  const maxBytes = maxKb * 1024;
  if (buf.byteLength <= maxBytes) {
    return { text: buf.toString("utf-8"), truncated: false };
  }
  // Use TextDecoder fatal:false to silently drop a dangling partial code-point.
  const slice = buf.subarray(0, maxBytes);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  return { text, truncated: true };
}
