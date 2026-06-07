// Pure: parses the combined stdout produced by `curl -D - -o - -w <meta>`.
// Layout: <header-block-1>\r\n\r\n[<header-block-2>\r\n\r\n...]<body>__CURL_META__<status>|<url>|<time>|<size>
// The header-block-N repetition happens when -L follows redirects: we keep the
// LAST block as the authoritative response, and mark `redirected:true`.
const META_TAG = "__CURL_META__";
const SEP = "\r\n\r\n";

export interface ParsedCurl {
  status_code: number;
  status_text: string;
  headers: Record<string, string>;
  body: Buffer;
  final_url: string;
  response_time_ms: number;
  size_bytes: number;
  redirected: boolean;
}

export function parseHeaderBlock(block: string): { status_code: number; status_text: string; headers: Record<string, string> } {
  const lines = block.split(/\r\n/).filter((l) => l.length > 0);
  const statusLine = lines.shift() ?? "";
  const m = statusLine.match(/^HTTP\/[\d.]+ (\d+)(?: (.*))?$/);
  const status_code = m ? Number(m[1]) : 0;
  const status_text = (m?.[2] ?? "").trim();
  const headers: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return { status_code, status_text, headers };
}

export function parseCurlStdout(stdout: Buffer): ParsedCurl {
  const text = stdout.toString("binary"); // byte-preserving search
  const metaIdx = text.lastIndexOf(META_TAG);
  if (metaIdx === -1) throw new Error("curl stdout missing metadata trailer (write-out)");
  const metaLine = text.slice(metaIdx + META_TAG.length).trim();
  const [statusStr, finalUrl, timeStr, sizeStr] = metaLine.split("|");

  // Find consecutive header blocks (handles redirect chains).
  const headerEnd: number[] = [];
  let cursor = 0;
  while (true) {
    const at = text.indexOf(SEP, cursor);
    if (at === -1 || at >= metaIdx) break;
    headerEnd.push(at);
    cursor = at + SEP.length;
    // Stop scanning if the next bytes don't start a new HTTP/ status line.
    if (!text.startsWith("HTTP/", cursor)) break;
  }
  if (headerEnd.length === 0) throw new Error("curl stdout missing header block");

  const headerBlock = text.slice(headerEnd.length === 1 ? 0 : headerEnd[headerEnd.length - 2] + SEP.length, headerEnd[headerEnd.length - 1]);
  const parsed = parseHeaderBlock(headerBlock);
  const bodyStart = headerEnd[headerEnd.length - 1] + SEP.length;
  const body = Buffer.from(text.slice(bodyStart, metaIdx), "binary");

  return {
    ...parsed,
    body,
    final_url: finalUrl ?? "",
    response_time_ms: Math.round(parseFloat(timeStr ?? "0") * 1000),
    size_bytes: parseInt(sizeStr ?? "0", 10),
    redirected: headerEnd.length > 1,
  };
}
