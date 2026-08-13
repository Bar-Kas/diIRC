import { UrlAuthRule } from "./types";

export function getAuthHeadersForUrl(url: string, rules: UrlAuthRule[]): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!url || !Array.isArray(rules)) return headers;

  for (const rule of rules) {
    if (rule.urlPrefix && url.startsWith(rule.urlPrefix)) {
      headers[rule.headerName] = rule.headerValue;
    }
  }

  return headers;
}
