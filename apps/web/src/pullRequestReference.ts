const GITHUB_PULL_REQUEST_URL_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+)(?:[/?#].*)?$/i;
const PULL_REQUEST_NUMBER_PATTERN = /^#?(\d+)$/;

function normalizePullRequestNumber(value: string): string | null {
  const normalized = value.replace(/^0+/, "");
  return normalized.length > 0 ? normalized : null;
}

export function parsePullRequestReference(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const urlMatch = GITHUB_PULL_REQUEST_URL_PATTERN.exec(trimmed);
  if (urlMatch?.[1]) {
    return normalizePullRequestNumber(urlMatch[1]);
  }

  const numberMatch = PULL_REQUEST_NUMBER_PATTERN.exec(trimmed);
  if (numberMatch?.[1]) {
    return normalizePullRequestNumber(numberMatch[1]);
  }

  return null;
}
