import { Schema } from "effect";

type IpcHandlerRegistrar = {
  removeHandler: (channel: string) => void;
  handle: (channel: string, listener: (event: unknown, payload: unknown) => unknown) => void;
};

export function decodeIpcPayload<S extends Schema.Top>(
  schema: S,
  payload: unknown,
): Schema.Schema.Type<S> {
  return Schema.decodeUnknownSync(schema as never)(payload) as Schema.Schema.Type<S>;
}

export function safeDecodeIpcPayload<S extends Schema.Top>(
  schema: S,
  payload: unknown,
): Schema.Schema.Type<S> | null {
  try {
    return decodeIpcPayload(schema, payload);
  } catch {
    return null;
  }
}

export function registerValidatedIpcHandler<S extends Schema.Top, R>(
  ipc: IpcHandlerRegistrar,
  channel: string,
  schema: S,
  handler: (input: Schema.Schema.Type<S>) => Promise<R> | R,
): void {
  ipc.removeHandler(channel);
  ipc.handle(channel, async (_event, payload: unknown) =>
    handler(decodeIpcPayload(schema, payload)),
  );
}
