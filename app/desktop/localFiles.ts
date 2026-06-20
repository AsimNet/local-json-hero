import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import type { LocalFilePayload } from "./types";

export function isTauriRuntime() {
  return Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function pickJsonFile() {
  if (!isTauriRuntime()) {
    return undefined;
  }

  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "JSON files",
        extensions: ["json", "jsonl", "ndjson"],
      },
    ],
  });

  if (typeof selected !== "string") {
    return undefined;
  }

  return selected;
}

export async function readLocalFile(path: string): Promise<LocalFilePayload> {
  return invoke<LocalFilePayload>("read_local_file", { path });
}

export async function getInitialOpenedFiles(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  return invoke<string[]>("opened_files");
}

export async function subscribeToNativeFileEvents({
  onOpen,
  onDragState,
}: {
  onOpen: (paths: string[]) => void;
  onDragState: (active: boolean) => void;
}) {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  const unlisteners: UnlistenFn[] = [];

  unlisteners.push(
    await listen<string[]>("opened-files", (event) => onOpen(event.payload))
  );

  unlisteners.push(
    await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        onDragState(true);
      } else if (event.payload.type === "drop") {
        onDragState(false);
        onOpen(event.payload.paths);
      } else {
        onDragState(false);
      }
    })
  );

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
