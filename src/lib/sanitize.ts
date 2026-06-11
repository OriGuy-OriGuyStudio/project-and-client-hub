import DOMPurify from "dompurify";

/**
 * Sanitize rich-text HTML (TipTap output) before it is stored or rendered.
 * Strips <script>, event handlers, and anything outside the editor's allowed
 * formatting set. Applied on save AND before dangerouslySetInnerHTML.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "a",
  "code",
  "pre",
];

const ALLOWED_ATTR = ["href", "target", "rel", "dir"];

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    // Defense in depth: never allow javascript:, data:, etc. URIs
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
  });
}

/** Hard cap helper for user-submitted plain-text fields. */
export function clampText(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
