import { trimOrNull } from "@t3tools/shared/model";

export interface SidebarSearchHighlightSegment {
  highlighted: boolean;
  key: string;
  text: string;
}

function tokenizeHighlightQuery(query: string): string[] {
  const normalizedQuery = trimOrNull(query);
  if (!normalizedQuery) {
    return [];
  }

  const tokens = normalizedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .filter((token, index, allTokens) => allTokens.indexOf(token) === index);
  return tokens.toSorted((left, right) => right.length - left.length);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildSidebarSearchHighlightSegments(
  text: string,
  query: string,
): SidebarSearchHighlightSegment[] {
  const tokens = tokenizeHighlightQuery(query);
  if (tokens.length === 0 || text.length === 0) {
    return [{ highlighted: false, key: "plain:0", text }];
  }

  const pattern = new RegExp(tokens.map(escapeRegExp).join("|"), "gi");
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length === 0) {
    return [{ highlighted: false, key: "plain:0", text }];
  }

  const segments: SidebarSearchHighlightSegment[] = [];
  let cursor = 0;

  for (const match of matches) {
    const matchText = match[0];
    const start = match.index ?? 0;
    const end = start + matchText.length;
    if (end <= cursor) {
      continue;
    }

    if (start > cursor) {
      segments.push({
        highlighted: false,
        key: `plain:${cursor}`,
        text: text.slice(cursor, start),
      });
    }

    segments.push({
      highlighted: true,
      key: `hit:${start}`,
      text: text.slice(start, end),
    });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({
      highlighted: false,
      key: `plain:${cursor}`,
      text: text.slice(cursor),
    });
  }

  return segments;
}
