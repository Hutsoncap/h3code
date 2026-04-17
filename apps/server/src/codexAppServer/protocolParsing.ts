import { ProviderItemId, TurnId } from "@t3tools/contracts";

export interface JsonRpcRequest {
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  id: string | number;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
  };
}

export interface JsonRpcNotification {
  method: string;
  params?: unknown;
}

function brandIfNonEmpty<T extends string>(
  value: string | undefined,
  maker: (value: string) => T,
): T | undefined {
  const normalized = value?.trim();
  return normalized?.length ? maker(normalized) : undefined;
}

export function normalizeProviderThreadId(value: string | undefined): string | undefined {
  return brandIfNonEmpty(value, (normalized) => normalized);
}

export function toTurnId(value: string | undefined): TurnId | undefined {
  return brandIfNonEmpty(value, TurnId.makeUnsafe);
}

export function toProviderItemId(value: string | undefined): ProviderItemId | undefined {
  return brandIfNonEmpty(value, ProviderItemId.makeUnsafe);
}

export function readObject(value: unknown, key?: string): Record<string, unknown> | undefined {
  const target =
    key === undefined
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined;

  if (!target || typeof target !== "object") {
    return undefined;
  }

  return target as Record<string, unknown>;
}

export function readArray(value: unknown, key?: string): unknown[] | undefined {
  const target =
    key === undefined
      ? value
      : value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined;
  return Array.isArray(target) ? target : undefined;
}

export function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : undefined;
}

export function readBoolean(value: unknown, key: string): boolean | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

export function isServerRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.method === "string" &&
    (typeof candidate.id === "string" || typeof candidate.id === "number")
  );
}

export function isServerNotification(value: unknown): value is JsonRpcNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.method === "string" && !("id" in candidate);
}

export function isResponse(value: unknown): value is JsonRpcResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasId = typeof candidate.id === "string" || typeof candidate.id === "number";
  const hasMethod = typeof candidate.method === "string";
  const hasResult = "result" in candidate;
  const hasError = readObject(candidate, "error") !== undefined;
  return hasId && !hasMethod && (hasResult || hasError);
}

export function readRouteFields(params: unknown): {
  turnId?: TurnId;
  itemId?: ProviderItemId;
} {
  const route: {
    turnId?: TurnId;
    itemId?: ProviderItemId;
  } = {};

  const turnId = toTurnId(
    readString(params, "turnId") ?? readString(readObject(params, "turn"), "id"),
  );
  const itemId = toProviderItemId(
    readString(params, "itemId") ?? readString(readObject(params, "item"), "id"),
  );

  if (turnId) {
    route.turnId = turnId;
  }

  if (itemId) {
    route.itemId = itemId;
  }

  return route;
}

export function readProviderConversationId(params: unknown): string | undefined {
  return (
    readString(params, "threadId") ??
    readString(readObject(params, "thread"), "id") ??
    readString(params, "conversationId")
  );
}

export function readThreadIdFromResponse(method: string, response: unknown): string {
  const responseRecord = readObject(response);
  const thread = readObject(responseRecord, "thread");
  const threadIdRaw = readString(thread, "id") ?? readString(responseRecord, "threadId");
  if (!threadIdRaw) {
    throw new Error(`${method} response did not include a thread id.`);
  }
  return threadIdRaw;
}
