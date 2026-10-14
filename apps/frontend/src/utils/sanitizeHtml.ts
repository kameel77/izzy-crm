const FORBIDDEN_TAGS = new Set([
  "script",
  "iframe",
  "object",
  "embed",
  "applet",
  "meta",
  "link",
  "base",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "style",
  "svg",
  "math",
]);

const URL_ATTRIBUTES = new Set(["href", "src", "xlink:href", "action", "formaction"]);

const isUnsafeUrl = (value: string): boolean => {
  const normalized = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join("")
    .toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:text/html") ||
    normalized.startsWith("data:application/xhtml")
  );
};

export const sanitizeHtml = (rawHtml: string | null | undefined): string => {
  if (!rawHtml) return "";

  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const elements = Array.from(doc.body.querySelectorAll("*"));
    for (const el of elements) {
      const tagName = el.tagName.toLowerCase();
      if (FORBIDDEN_TAGS.has(tagName)) {
        el.remove();
        continue;
      }

      for (const attr of Array.from(el.attributes)) {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith("on") || attrName === "srcdoc") {
          el.removeAttribute(attr.name);
          continue;
        }
        if (URL_ATTRIBUTES.has(attrName) && isUnsafeUrl(attr.value)) {
          el.removeAttribute(attr.name);
        }
      }
    }

    return doc.body.innerHTML;
  }

  return rawHtml
    .replace(/<\s*(script|iframe|object|embed|applet|meta|link|base|form|input|button|select|textarea|style|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|applet|meta|link|base|form|input|button|select|textarea|style|svg|math)\b[^>]*\/?\s*>/gi, "")
    .replace(/\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|xlink:href|action|formaction)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|(?:\s*(?:javascript|vbscript|data):[^\s>]+))/gi, "");
};
