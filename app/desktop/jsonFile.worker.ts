import type { ParseRequest, ParseResult } from "./types";

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (event: MessageEvent<ParseRequest>) => {
  const result = parseText(event.data);
  self.postMessage(result);
};

function parseText(request: ParseRequest): ParseResult {
  const isJsonlMode =
    request.mode === "jsonl-array" || request.mode === "jsonl-sample";
  const isJsonlExtension = /\.(jsonl|ndjson)$/i.test(request.title);

  if (isJsonlMode) {
    return parseJsonl(request, request.mode === "jsonl-sample");
  }

  if (!isJsonlExtension) {
    try {
      return {
        ok: true,
        json: JSON.parse(request.text),
        parseInfo: { format: "json" },
      };
    } catch (jsonError) {
      if (!looksLikeJsonl(request.text)) {
        return { ok: false, error: getErrorMessage(jsonError) };
      }
    }
  }

  const jsonlResult = parseJsonl(request, false);
  if (jsonlResult.ok) {
    return jsonlResult;
  }

  if (isJsonlExtension) {
    return jsonlResult;
  }

  return {
    ok: false,
    error: `Invalid JSON. JSONL fallback also failed: ${jsonlResult.error}`,
    line: jsonlResult.line,
  };
}

function parseJsonl(request: ParseRequest, sample: boolean): ParseResult {
  const rows: unknown[] = [];
  const lines = request.text.split(/\r?\n/);
  let lineCount = 0;

  for (let index = 0; index < lines.length; index++) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    lineCount += 1;

    try {
      if (!sample || rows.length < request.sampleLimit) {
        rows.push(JSON.parse(line));
      }
    } catch (error) {
      return {
        ok: false,
        line: index + 1,
        error: `Invalid JSONL at line ${index + 1}: ${getErrorMessage(error)}`,
      };
    }
  }

  return {
    ok: true,
    json: rows,
    parseInfo: {
      format: "jsonl",
      lineCount,
      sampled: sample && lineCount > rows.length,
      sampleSize: rows.length,
    },
  };
}

function looksLikeJsonl(text: string) {
  const nonEmptyLines = text
    .split(/\r?\n/, 3)
    .map((line) => line.trim())
    .filter(Boolean);

  return nonEmptyLines.length > 1;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
