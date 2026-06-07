// TypeBox schema for the `curl` tool's parameters. The descriptions are read
// by the calling LLM, so they encode the contract (defaults, mutual exclusivity,
// security implications). Field order and names mirror types.ts CurlInput.
import { Type } from "typebox";

const MethodSchema = Type.Union(
  [
    Type.Literal("GET"),
    Type.Literal("POST"),
    Type.Literal("PUT"),
    Type.Literal("PATCH"),
    Type.Literal("DELETE"),
    Type.Literal("HEAD"),
    Type.Literal("OPTIONS"),
  ],
  { description: "HTTP method. Defaults to GET." },
);

const ReturnFormatSchema = Type.Union(
  [Type.Literal("text"), Type.Literal("json"), Type.Literal("headers_only")],
  { description: "Response shape. 'json' auto-parses the body (throws JsonParseError if invalid). 'headers_only' returns just the response headers as text. Defaults to 'text'." },
);

export const CurlParams = Type.Object({
  url: Type.String({
    description: "Absolute http(s) URL. Hostname is SSRF-checked (private nets blocked) unless allow_private:true.",
  }),
  method: Type.Optional(MethodSchema),
  headers: Type.Optional(
    Type.Record(Type.String(), Type.String(), {
      description: "Extra request headers. A default User-Agent is already set by the extension; do NOT set 'Host' (curl manages it).",
    }),
  ),
  body: Type.Optional(
    Type.Union([Type.String(), Type.Record(Type.String(), Type.Unknown())], {
      description: "Request body. If an object, it is JSON-serialized and Content-Type:application/json is set automatically. Mutually exclusive with `form`.",
    }),
  ),
  query: Type.Optional(
    Type.Record(Type.String(), Type.String(), {
      description: "Query-string parameters; URL-encoded and appended to `url`.",
    }),
  ),
  form: Type.Optional(
    Type.Record(Type.String(), Type.String(), {
      description: "application/x-www-form-urlencoded body. Mutually exclusive with `body`.",
    }),
  ),
  basic_auth: Type.Optional(
    Type.Object(
      { user: Type.String(), pass: Type.String() },
      { description: "HTTP Basic auth (curl -u user:pass)." },
    ),
  ),
  cookies: Type.Optional(
    Type.Record(Type.String(), Type.String(), {
      description: "Cookies serialized into a single Cookie header. No persistent jar between calls.",
    }),
  ),
  follow_redirects: Type.Optional(
    Type.Boolean({
      description: "Follow up to 5 redirects (curl -L --max-redirs 5). Default from config (true). NOTE: redirect targets are NOT SSRF-checked — only the initial URL.",
    }),
  ),
  timeout_seconds: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 120,
      description: "Total request timeout (curl --max-time). Default from config (30). Max 120.",
    }),
  ),
  max_size_kb: Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum: 10000,
      description: "Soft body cap. Hard cap is 2x via curl --max-filesize. Default from config (500). Max 10000 (10 MB).",
    }),
  ),
  ignore_ssl: Type.Optional(
    Type.Boolean({
      description: "Disable TLS verification (curl -k). DANGEROUS — only for self-signed test endpoints.",
    }),
  ),
  allow_private: Type.Optional(
    Type.Boolean({
      description: "Bypass SSRF guard AND proxy. Required for local services (localhost, 192.168.x). The request goes direct — no proxy, no IP rewrite, so the target sees your real IP.",
    }),
  ),
  return_format: Type.Optional(ReturnFormatSchema),
});
