import { type TimestampFormat } from "./appSettings";

export function getTimestampFormatOptions(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormatOptions {
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  };

  if (timestampFormat === "locale") {
    return baseOptions;
  }

  return {
    ...baseOptions,
    hour12: timestampFormat === "12-hour",
  };
}

const timestampFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getTimestampFormatter(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormat {
  const cacheKey = `${timestampFormat}:${includeSeconds ? "seconds" : "minutes"}`;
  const cachedFormatter = timestampFormatterCache.get(cacheKey);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(
    undefined,
    getTimestampFormatOptions(timestampFormat, includeSeconds),
  );
  timestampFormatterCache.set(cacheKey, formatter);
  return formatter;
}

function parseTimestampInput(isoDate: string): Date | null {
  let normalizedIsoDate = isoDate.trim();
  if (
    (normalizedIsoDate.startsWith('"') && normalizedIsoDate.endsWith('"')) ||
    (normalizedIsoDate.startsWith("'") && normalizedIsoDate.endsWith("'"))
  ) {
    normalizedIsoDate = normalizedIsoDate.slice(1, -1).trim();
  }
  if (normalizedIsoDate.length === 0) {
    return null;
  }

  const date = new Date(normalizedIsoDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestamp(isoDate: string, timestampFormat: TimestampFormat): string {
  const parsedDate = parseTimestampInput(isoDate);
  if (!parsedDate) return "";
  return getTimestampFormatter(timestampFormat, true).format(parsedDate);
}

export function formatShortTimestamp(isoDate: string, timestampFormat: TimestampFormat): string {
  const parsedDate = parseTimestampInput(isoDate);
  if (!parsedDate) return "";
  return getTimestampFormatter(timestampFormat, false).format(parsedDate);
}
