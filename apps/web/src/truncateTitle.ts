export function truncateTitle(text: string, maxLength = 50): string {
  const trimmed = text.trim();
  const normalizedMaxLength = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 50;

  if (trimmed.length <= normalizedMaxLength) {
    return trimmed;
  }

  if (normalizedMaxLength <= 3) {
    return ".".repeat(normalizedMaxLength);
  }

  return `${trimmed.slice(0, normalizedMaxLength - 3)}...`;
}
