import React, {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { render } from "react-dom";
import {
  ClipboardCopyIcon,
  CodeIcon,
  DownloadIcon,
  ExclamationCircleIcon,
  FolderOpenIcon,
  RefreshIcon,
  TemplateIcon,
  UploadIcon,
} from "@heroicons/react/outline";
import { useHotkeys } from "react-hotkeys-hook";
import { JsonColumnView } from "~/components/JsonColumnView";
import { JsonEditor } from "~/components/JsonEditor";
import { JsonTreeView } from "~/components/JsonTreeView";
import { JsonView } from "~/components/JsonView";
import { InfoPanel } from "~/components/InfoPanel";
import Resizable from "~/components/Resizable";
import { TreeIcon } from "~/components/Icons/TreeIcon";
import { JsonColumnViewProvider } from "~/hooks/useJsonColumnView";
import { JsonDocProvider } from "~/hooks/useJsonDoc";
import { JsonProvider } from "~/hooks/useJson";
import { JsonSearchProvider } from "~/hooks/useJsonSearch";
import { JsonSchemaProvider } from "~/hooks/useJsonSchema";
import { JsonTreeViewProvider } from "~/hooks/useJsonTree";
import { PreferencesProvider } from "~/components/PreferencesProvider";
import { ThemeProvider } from "~/components/ThemeProvider";
import { formatBytes } from "~/utilities/formatter";
import {
  getInitialOpenedFiles,
  isTauriRuntime,
  pickJsonFile,
  readLocalFile,
  subscribeToNativeFileEvents,
} from "./localFiles";
import type {
  DesktopDocument,
  DesktopSource,
  JsonlMode,
  LocalFilePayload,
  ParseMode,
  ParseResult,
} from "./types";
import "~/tailwind.css";

type ViewMode = "columns" | "editor" | "tree";

type LoadState =
  | { status: "idle" }
  | { status: "reading"; label: string }
  | { status: "parsing"; label: string }
  | { status: "error"; title: string; message: string };

const SAMPLE_LIMIT = 1000;

class DesktopErrorBoundary extends Component<
  { children: React.ReactNode },
  { error?: Error }
> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-red-50 p-6 text-red-900">
          <h1 className="mb-3 text-lg font-bold">
            Local JSON Hero could not render this document
          </h1>
          <pre className="whitespace-pre-wrap text-sm">
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

function DesktopApp() {
  const [document, setDocument] = useState<DesktopDocument | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [viewMode, setViewMode] = useState<ViewMode>("columns");
  const [jsonlMode, setJsonlMode] = useState<JsonlMode>("array");
  const [nativeDragging, setNativeDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const lastNativeOpenRef = useRef<{ path: string; openedAt: number } | null>(
    null
  );

  const loadText = useCallback(
    async ({
      text,
      title,
      source,
      path,
      size,
      mode = "auto",
    }: {
      text: string;
      title: string;
      source: DesktopSource;
      path?: string;
      size?: number;
      mode?: ParseMode;
    }) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setLoadState({ status: "parsing", label: title });

      const result = await parseJsonText({
        text,
        title,
        mode,
        sampleLimit: SAMPLE_LIMIT,
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (!result.ok) {
        setLoadState({
          status: "error",
          title: "Invalid JSON",
          message: result.line
            ? `${result.error}`
            : `${result.error || "Unable to parse this file."}`,
        });
        return;
      }

      const id = `local-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

      setDocument({
        id,
        json: result.json,
        rawText: text,
        source,
        path,
        size,
        parseInfo: result.parseInfo,
        doc: {
          id,
          type: "raw",
          contents: text,
          title,
          readOnly: false,
        },
      });
      setViewMode("columns");
      setLoadState({ status: "idle" });
    },
    []
  );

  const loadBrowserFile = useCallback(
    async (file: File, source: DesktopSource = "drop") => {
      setLoadState({ status: "reading", label: file.name });
      try {
        await loadText({
          text: await file.text(),
          title: file.name,
          source,
          size: file.size,
        });
      } catch (error) {
        setLoadState({
          status: "error",
          title: "Could not read file",
          message: getErrorMessage(error),
        });
      }
    },
    [loadText]
  );

  const loadPath = useCallback(
    async (path: string, source: DesktopSource = "file") => {
      setLoadState({ status: "reading", label: path });
      try {
        const payload = await readLocalFile(path);
        await loadLocalPayload(payload, source, loadText);
      } catch (error) {
        setLoadState({
          status: "error",
          title: "Could not open file",
          message: getErrorMessage(error),
        });
      }
    },
    [loadText]
  );

  const loadNativePaths = useCallback(
    (paths: string[]) => {
      const path = paths[0];

      if (!path) {
        return;
      }

      const now = Date.now();
      const lastNativeOpen = lastNativeOpenRef.current;

      if (
        lastNativeOpen?.path === path &&
        now - lastNativeOpen.openedAt < 1000
      ) {
        return;
      }

      lastNativeOpenRef.current = { path, openedAt: now };
      loadPath(path, "finder");
    },
    [loadPath]
  );

  const openFile = useCallback(async () => {
    if (!isTauriRuntime()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const path = await pickJsonFile();
      if (path) {
        await loadPath(path, "file");
      }
    } catch (error) {
      setLoadState({
        status: "error",
        title: "Could not open file picker",
        message: getErrorMessage(error),
      });
    }
  }, [loadPath]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setLoadState({
          status: "error",
          title: "Clipboard is empty",
          message: "Copy JSON or JSONL text, then paste again.",
        });
        return;
      }

      await loadText({
        text,
        title: "Pasted JSON",
        source: "paste",
        size: new Blob([text]).size,
      });
    } catch (error) {
      setLoadState({
        status: "error",
        title: "Could not read clipboard",
        message: getErrorMessage(error),
      });
    }
  }, [loadText]);

  const reloadJsonl = useCallback(
    async (mode: JsonlMode) => {
      if (!document) {
        return;
      }

      setJsonlMode(mode);
      await loadText({
        text: document.rawText,
        title: document.doc.title,
        source: document.source,
        path: document.path,
        size: document.size,
        mode: mode === "sample" ? "jsonl-sample" : "jsonl-array",
      });
    },
    [document, loadText]
  );

  const updateTitle = useCallback((title: string) => {
    setDocument((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        doc: {
          ...current.doc,
          title,
        },
      };
    });
  }, []);

  const downloadCurrent = useCallback(() => {
    if (!document) {
      return;
    }

    const blob = new Blob([JSON.stringify(document.json, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = document.doc.title.replace(/\.(jsonl|ndjson)$/i, ".json");
    anchor.click();
    URL.revokeObjectURL(url);
  }, [document]);

  const handleDroppedFiles = useCallback(
    async (files: FileList | null) => {
      const firstFile = files?.item(0);
      if (firstFile) {
        await loadBrowserFile(firstFile, "drop");
      }
    },
    [loadBrowserFile]
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const text = event.clipboardData?.getData("text");
      if (!text?.trim()) {
        return;
      }

      event.preventDefault();
      loadText({
        text,
        title: "Pasted JSON",
        source: "paste",
        size: new Blob([text]).size,
      });
    };

    window.document.addEventListener("paste", onPaste);
    return () => window.document.removeEventListener("paste", onPaste);
  }, [loadText]);

  useEffect(() => {
    let unlisten: () => void = () => undefined;
    let disposed = false;

    subscribeToNativeFileEvents({
      onOpen: loadNativePaths,
      onDragState: setNativeDragging,
    }).then((dispose) => {
      if (disposed) {
        dispose();
        return;
      }

      unlisten = dispose;
      getInitialOpenedFiles().then((paths) => {
        if (!disposed) {
          loadNativePaths(paths);
        }
      });
    });

    return () => {
      disposed = true;
      unlisten();
    };
  }, [loadNativePaths]);

  const jsonlControls =
    document?.parseInfo.format === "jsonl" ? (
      <JsonlControls
        mode={jsonlMode}
        parseInfo={document.parseInfo}
        onChange={reloadJsonl}
      />
    ) : null;

  return (
    <ThemeProvider specifiedTheme="dark">
      <PreferencesProvider>
        <div
          className="h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 transition dark:bg-slate-900 dark:text-slate-100"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleDroppedFiles(event.dataTransfer.files);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".json,.jsonl,.ndjson,application/json,application/x-ndjson,text/plain"
            onChange={(event) => {
              handleDroppedFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />

          <DesktopHeader
            document={document}
            loadState={loadState}
            onOpenFile={openFile}
            onPaste={pasteFromClipboard}
            onTitleChange={updateTitle}
            jsonlControls={jsonlControls}
          />

          {document ? (
            <DocumentWorkspace
              key={document.id}
              document={document}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onDownload={downloadCurrent}
            />
          ) : (
            <EmptyState
              loadState={loadState}
              nativeDragging={nativeDragging}
              onOpenFile={openFile}
              onPaste={pasteFromClipboard}
            />
          )}

          {nativeDragging && <DropOverlay />}
        </div>
      </PreferencesProvider>
    </ThemeProvider>
  );
}

function DocumentWorkspace({
  document,
  viewMode,
  onViewModeChange,
  onDownload,
}: {
  document: DesktopDocument;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  onDownload: () => void;
}) {
  return (
    <JsonDocProvider doc={document.doc} key={document.id}>
      <JsonProvider initialJson={document.json}>
        <JsonSchemaProvider>
          <JsonColumnViewProvider>
            <JsonSearchProvider>
              <div className="h-[calc(100vh-40px)] flex flex-col sm:overflow-hidden">
                <div className="bg-slate-50 flex-grow transition dark:bg-slate-900 overflow-y-auto">
                  <div className="main-container flex justify-items-stretch h-full">
                    <DesktopSideBar
                      viewMode={viewMode}
                      onViewModeChange={onViewModeChange}
                      onDownload={onDownload}
                    />
                    <JsonView>
                      {viewMode === "columns" ? (
                        <JsonColumnView />
                      ) : viewMode === "editor" ? (
                        <JsonEditor />
                      ) : (
                        <JsonTreeViewProvider overscan={25}>
                          <JsonTreeView />
                        </JsonTreeViewProvider>
                      )}
                    </JsonView>

                    <Resizable
                      isHorizontal={true}
                      initialSize={500}
                      minimumSize={280}
                      maximumSize={900}
                    >
                      <div className="info-panel flex-grow h-full">
                        <InfoPanel />
                      </div>
                    </Resizable>
                  </div>
                </div>
              </div>
            </JsonSearchProvider>
          </JsonColumnViewProvider>
        </JsonSchemaProvider>
      </JsonProvider>
    </JsonDocProvider>
  );
}

function DesktopHeader({
  document,
  loadState,
  onOpenFile,
  onPaste,
  onTitleChange,
  jsonlControls,
}: {
  document: DesktopDocument | null;
  loadState: LoadState;
  onOpenFile: () => void;
  onPaste: () => void;
  onTitleChange: (title: string) => void;
  jsonlControls: React.ReactNode;
}) {
  const [draftTitle, setDraftTitle] = useState(document?.doc.title ?? "");

  useEffect(() => {
    setDraftTitle(document?.doc.title ?? "");
  }, [document?.id, document?.doc.title]);

  return (
    <header className="flex items-center justify-between w-screen h-[40px] bg-indigo-700 dark:bg-slate-800 border-b-[1px] border-slate-600">
      <div className="flex pl-3 gap-2 h-8 justify-center items-center">
        <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-lime-400 text-xs font-black text-slate-950">
          J
        </div>
        <div className="text-sm font-bold text-slate-100 whitespace-nowrap">
          Local JSON Hero
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-3 px-4">
        {document ? (
          <label className="min-w-[220px] max-w-[40vw] flex-1">
            <input
              className="w-full border-none text-ellipsis text-center text-slate-300 px-2 py-1 rounded-sm bg-transparent placeholder:text-slate-400 focus:bg-black/30 focus:outline-none hover:bg-black hover:bg-opacity-20 transition"
              value={draftTitle}
              spellCheck={false}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={() => onTitleChange(draftTitle || "Untitled JSON")}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
        ) : (
          <span className="text-sm text-slate-300">
            Open a local JSON, JSONL, or NDJSON file
          </span>
        )}
        {jsonlControls}
        <HeaderStatus loadState={loadState} document={document} />
      </div>

      <div className="flex items-center gap-2 px-3">
        <HeaderButton onClick={onOpenFile} title="Open JSON file">
          <FolderOpenIcon className="w-4 h-4 mr-1" />
          Open
        </HeaderButton>
        <HeaderButton onClick={onPaste} title="Paste JSON from clipboard">
          <ClipboardCopyIcon className="w-4 h-4 mr-1" />
          Paste
        </HeaderButton>
      </div>
    </header>
  );
}

function HeaderButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex items-center justify-center py-1 bg-slate-200 text-slate-800 bg-opacity-90 text-base font-bold px-2 rounded uppercase hover:cursor-pointer hover:bg-opacity-100 transition"
    >
      {children}
    </button>
  );
}

function HeaderStatus({
  loadState,
  document,
}: {
  loadState: LoadState;
  document: DesktopDocument | null;
}) {
  if (loadState.status === "reading" || loadState.status === "parsing") {
    return (
      <span className="flex items-center text-xs text-lime-300">
        <RefreshIcon className="mr-1 h-3 w-3 animate-spin" />
        {loadState.status === "reading" ? "Reading" : "Parsing"}
      </span>
    );
  }

  if (loadState.status === "error") {
    return (
      <span className="flex min-w-0 items-center truncate text-xs text-red-200">
        <ExclamationCircleIcon className="mr-1 h-4 w-4 flex-none" />
        <span className="truncate" title={loadState.message}>
          {loadState.message}
        </span>
      </span>
    );
  }

  if (!document) {
    return null;
  }

  const detail =
    document.parseInfo.format === "jsonl"
      ? `${document.parseInfo.lineCount ?? 0} JSONL rows`
      : "JSON";

  return (
    <span className="hidden min-w-0 truncate text-xs text-slate-300 lg:block">
      {detail}
      {document.size ? ` · ${formatBytes(document.size)}` : ""}
    </span>
  );
}

function DesktopSideBar({
  viewMode,
  onViewModeChange,
  onDownload,
}: {
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  onDownload: () => void;
}) {
  useHotkeys("option+1,alt+1", () => onViewModeChange("columns"), [
    onViewModeChange,
  ]);
  useHotkeys("option+2,alt+2", () => onViewModeChange("editor"), [
    onViewModeChange,
  ]);
  useHotkeys("option+3,alt+3", () => onViewModeChange("tree"), [
    onViewModeChange,
  ]);

  return (
    <div className="side-bar flex flex-col align-center justify-between h-full p-1 bg-slate-200 transition dark:bg-slate-800">
      <ol className="relative">
        <DesktopSideBarButton
          active={viewMode === "columns"}
          title="Column view"
          onClick={() => onViewModeChange("columns")}
        >
          <TemplateIcon className="p-2 w-full h-full" />
        </DesktopSideBarButton>
        <DesktopSideBarButton
          active={viewMode === "editor"}
          title="JSON view"
          onClick={() => onViewModeChange("editor")}
        >
          <CodeIcon className="p-2 w-full h-full" />
        </DesktopSideBarButton>
        <DesktopSideBarButton
          active={viewMode === "tree"}
          title="Tree view"
          onClick={() => onViewModeChange("tree")}
        >
          <TreeIcon className="p-2 w-full h-full" />
        </DesktopSideBarButton>
      </ol>
      <ol>
        <DesktopSideBarButton
          active={false}
          title="Download current JSON"
          onClick={onDownload}
        >
          <DownloadIcon className="p-2 w-full h-full" />
        </DesktopSideBarButton>
      </ol>
    </div>
  );
}

function DesktopSideBarButton({
  active,
  title,
  children,
  onClick,
}: {
  active: boolean;
  title: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const classes = active
    ? "relative w-10 h-10 mb-1 text-white bg-indigo-700 rounded-sm cursor:pointer transition"
    : "relative w-10 h-10 mb-1 text-slate-700 hover:bg-slate-300 rounded-sm cursor:pointer transition dark:text-white dark:hover:bg-slate-700";

  return (
    <li className={classes}>
      <button
        type="button"
        title={title}
        className="h-full w-full"
        onClick={onClick}
      >
        {children}
      </button>
    </li>
  );
}

function JsonlControls({
  mode,
  parseInfo,
  onChange,
}: {
  mode: JsonlMode;
  parseInfo: DesktopDocument["parseInfo"];
  onChange: (mode: JsonlMode) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-sm bg-black/20 text-xs font-bold text-slate-200">
      <button
        type="button"
        onClick={() => onChange("array")}
        className={`px-2 py-1 transition ${
          mode === "array" ? "bg-lime-400 text-slate-950" : "hover:bg-white/10"
        }`}
      >
        Full JSONL
      </button>
      <button
        type="button"
        onClick={() => onChange("sample")}
        className={`px-2 py-1 transition ${
          mode === "sample" ? "bg-lime-400 text-slate-950" : "hover:bg-white/10"
        }`}
      >
        Sample {SAMPLE_LIMIT}
      </button>
      {parseInfo.sampled && (
        <span className="px-2 text-lime-200">
          Showing {parseInfo.sampleSize} of {parseInfo.lineCount}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  loadState,
  nativeDragging,
  onOpenFile,
  onPaste,
}: {
  loadState: LoadState;
  nativeDragging: boolean;
  onOpenFile: () => void;
  onPaste: () => void;
}) {
  return (
    <main className="flex h-[calc(100vh-40px)] items-center justify-center bg-slate-100 p-8 transition dark:bg-slate-900">
      <div className="w-full max-w-2xl rounded-md border border-dashed border-slate-400 bg-white p-8 text-center shadow-sm transition dark:border-slate-600 dark:bg-slate-800">
        <UploadIcon
          className={`mx-auto mb-4 h-12 w-12 ${
            nativeDragging ? "text-lime-400" : "text-slate-400"
          }`}
        />
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">
          Open a local JSON document
        </h1>
        <p className="mx-auto mb-6 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Drop a JSON, JSONL, or NDJSON file here, open it from Finder, choose a
          file with the native picker, or paste JSON text from the clipboard.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenFile}
            className="inline-flex items-center rounded-sm bg-indigo-600 px-4 py-2 text-sm font-bold uppercase text-white transition hover:bg-indigo-500"
          >
            <FolderOpenIcon className="mr-2 h-5 w-5" />
            Open file
          </button>
          <button
            type="button"
            onClick={onPaste}
            className="inline-flex items-center rounded-sm bg-slate-200 px-4 py-2 text-sm font-bold uppercase text-slate-900 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
          >
            <ClipboardCopyIcon className="mr-2 h-5 w-5" />
            Paste JSON
          </button>
        </div>

        {loadState.status === "error" && (
          <div className="mt-6 rounded-sm bg-red-50 p-4 text-left text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200">
            <div className="mb-1 font-bold">{loadState.title}</div>
            <div>{loadState.message}</div>
          </div>
        )}
      </div>
    </main>
  );
}

function DropOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/55">
      <div className="rounded-md border-2 border-dashed border-lime-300 bg-slate-950/90 px-8 py-6 text-center text-lime-200">
        <UploadIcon className="mx-auto mb-3 h-12 w-12" />
        <div className="text-lg font-bold">Drop to open locally</div>
      </div>
    </div>
  );
}

async function loadLocalPayload(
  payload: LocalFilePayload,
  source: DesktopSource,
  loadText: (input: {
    text: string;
    title: string;
    source: DesktopSource;
    path?: string;
    size?: number;
  }) => Promise<void>
) {
  await loadText({
    text: payload.contents,
    title: payload.title,
    source,
    path: payload.path,
    size: payload.size,
  });
}

function parseJsonText(request: {
  text: string;
  title: string;
  mode: ParseMode;
  sampleLimit: number;
}) {
  return new Promise<ParseResult>((resolve) => {
    const workerUrl = new URL("desktop-json-worker.js", window.location.href);
    const worker = new Worker(workerUrl, { type: "module" });

    worker.onmessage = (event: MessageEvent<ParseResult>) => {
      worker.terminate();
      resolve(event.data);
    };

    worker.onerror = (event) => {
      worker.terminate();
      resolve({
        ok: false,
        error: event.message || "Could not parse this file.",
      });
    };

    worker.postMessage(request);
  });
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function mountDesktopApp() {
  render(
    <DesktopErrorBoundary>
      <DesktopApp />
    </DesktopErrorBoundary>,
    window.document.getElementById("root")
  );
}
