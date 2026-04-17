import { Schema } from "effect";

export type IpcHandlerRegistrar = {
  removeHandler: (channel: string) => void;
  handle: (channel: string, listener: (event: unknown, payload: unknown) => unknown) => void;
};

type ValidatedIpcHandlerOptions = {
  rejectUnknownFieldsInDevelopment?: boolean;
  isDevelopment?: boolean;
};

const DEV_EXACT_SCHEMA_PARSE_OPTIONS = { onExcessProperty: "error" } as const;

function withDevelopmentExactSchema<S extends Schema.Top>(
  schema: S,
  options?: ValidatedIpcHandlerOptions,
): S {
  if (options?.rejectUnknownFieldsInDevelopment !== true || options.isDevelopment !== true) {
    return schema;
  }

  return schema.annotate({ parseOptions: DEV_EXACT_SCHEMA_PARSE_OPTIONS }) as S;
}

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
  options?: ValidatedIpcHandlerOptions,
): void {
  const decodeSchema = withDevelopmentExactSchema(schema, options);
  ipc.removeHandler(channel);
  ipc.handle(channel, async (_event, payload: unknown) =>
    handler(decodeIpcPayload(decodeSchema, payload)),
  );
}
