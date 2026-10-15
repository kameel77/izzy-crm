const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);

const DANGEROUS_BLOCKS_REGEX =
  /<\s*(script|iframe|object|embed|form|style|meta|link|base|svg|math|applet|template|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const DANGEROUS_SELF_CLOSING_REGEX =
  /<\s*(script|iframe|object|embed|form|style|meta|link|base|svg|math|applet|template|noscript|input|button|textarea|select)\b[^>]*\/?>/gi;

const EVENT_HANDLER_ATTR_REGEX = /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const DANGEROUS_PROTOCOL_ATTR_REGEX =
  /(\s+(?:href|src|xlink:href|action|formaction|data|background|poster)\s*=\s*)(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|(?:\s*(?:javascript|vbscript|data):[^\s>]+))/gi;

export const sanitizeEmailHtml = (html: string): string => {
  if (!html) return "";
  let current = html;
  let previous = "";
  let iterations = 0;

  while (current !== previous && iterations < 5) {
    previous = current;
    current = current
      .replace(DANGEROUS_BLOCKS_REGEX, "")
      .replace(DANGEROUS_SELF_CLOSING_REGEX, "")
      .replace(EVENT_HANDLER_ATTR_REGEX, "")
      .replace(DANGEROUS_PROTOCOL_ATTR_REGEX, '$1"#"');
    iterations += 1;
  }

  return current;
};
