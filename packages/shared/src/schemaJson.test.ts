import { Cause, Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { decodeJsonResult, decodeUnknownJsonResult, formatSchemaError } from "./schemaJson";

const PersonFromJson = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
});

const expectSuccess = <A>(result: Result.Result<A, Cause.Cause<Schema.SchemaError>>) => {
  if (Result.isFailure(result)) {
    throw new Error(`Expected success, got failure: ${formatSchemaError(result.failure)}`);
  }

  return result.success;
};

const expectFailureMessage = (
  result: Result.Result<unknown, Cause.Cause<Schema.SchemaError>>,
  expectedParts: string[],
) => {
  expect(Result.isFailure(result)).toBe(true);
  if (!Result.isFailure(result)) {
    throw new Error("Expected failure result");
  }

  const message = formatSchemaError(result.failure);
  for (const expectedPart of expectedParts) {
    expect(message).toContain(expectedPart);
  }

  return message;
};

describe("decodeJsonResult", () => {
  it("decodes valid JSON strings into typed values", () => {
    const decode = decodeJsonResult(PersonFromJson);

    expect(expectSuccess(decode(JSON.stringify({ name: "Ada", age: 37 })))).toEqual({
      name: "Ada",
      age: 37,
    });
  });

  it("returns schema failures for malformed JSON strings", () => {
    const decode = decodeJsonResult(PersonFromJson);

    expectFailureMessage(decode("{"), ["SyntaxError:", "in JSON"]);
  });

  it("returns schema failures when parsed JSON does not match the schema", () => {
    const decode = decodeJsonResult(PersonFromJson);

    expectFailureMessage(decode(JSON.stringify({ name: "Ada", age: "37" })), [
      'Expected number, got "37"',
      'at ["age"]',
    ]);
  });
});

describe("decodeUnknownJsonResult", () => {
  it("decodes valid unknown inputs when they are JSON strings matching the schema", () => {
    const decode = decodeUnknownJsonResult(PersonFromJson);

    expect(expectSuccess(decode(JSON.stringify({ name: "Ada", age: 37 })))).toEqual({
      name: "Ada",
      age: 37,
    });
  });

  it("returns schema failures for malformed JSON string inputs", () => {
    const decode = decodeUnknownJsonResult(PersonFromJson);

    expectFailureMessage(decode("{"), ["SyntaxError:", "in JSON"]);
  });

  it("rejects unknown inputs that are not JSON strings", () => {
    const decode = decodeUnknownJsonResult(PersonFromJson);

    expectFailureMessage(decode(42), ["Expected string, got 42"]);
  });
});

describe("formatSchemaError", () => {
  it("formats schema causes with the default schema formatter", () => {
    const decode = decodeJsonResult(PersonFromJson);
    const result = decode(JSON.stringify({ name: "Ada", age: "37" }));

    expect(expectFailureMessage(result, ['Expected number, got "37"', 'at ["age"]'])).toBe(
      'Expected number, got "37"\n  at ["age"]',
    );
  });

  it("falls back to Cause.pretty for non-schema causes", () => {
    const message = formatSchemaError(
      Cause.fail(new Error("boom")) as unknown as Cause.Cause<Schema.SchemaError>,
    );

    expect(message).toContain("Error: boom");
  });
});
