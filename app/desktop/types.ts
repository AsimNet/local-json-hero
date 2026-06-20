import type { JSONDocument } from "~/jsonDoc.server";

export type DesktopSource = "file" | "drop" | "paste" | "finder";

export type JsonlMode = "array" | "sample";

export type ParseMode = "auto" | "json" | "jsonl-array" | "jsonl-sample";

export type ParseInfo = {
  format: "json" | "jsonl";
  lineCount?: number;
  sampled?: boolean;
  sampleSize?: number;
};

export type DesktopDocument = {
  id: string;
  doc: JSONDocument;
  json: unknown;
  rawText: string;
  source: DesktopSource;
  path?: string;
  size?: number;
  parseInfo: ParseInfo;
};

export type LocalFilePayload = {
  path: string;
  title: string;
  contents: string;
  size: number;
};

export type ParseRequest = {
  text: string;
  title: string;
  mode: ParseMode;
  sampleLimit: number;
};

export type ParseSuccess = {
  ok: true;
  json: unknown;
  parseInfo: ParseInfo;
};

export type ParseFailure = {
  ok: false;
  error: string;
  line?: number;
};

export type ParseResult = ParseSuccess | ParseFailure;
