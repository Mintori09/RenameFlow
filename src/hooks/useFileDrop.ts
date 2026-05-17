import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useFileStore } from "../stores/fileStore";

export type DragState = "idle" | "dragging";

export function useFileDrop() {
  const [dragState, setDragState] = useState<DragState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    (async () => {
      try {
        const wv = getCurrentWebview();
        unlisten = await wv.onDragDropEvent((event) => {
          console.log("[useFileDrop] event type:", event.payload.type,
            "paths:", (event.payload as { paths?: string[] }).paths?.length ?? "n/a");
          const { type } = event.payload;
          if (type === "enter" || type === "over") {
            setDragState("dragging");
          } else if (type === "leave") {
            setDragState("idle");
          } else if (type === "drop") {
            console.log("[useFileDrop] drop paths:", event.payload.paths);
            invoke<string[]>("resolve_drop_paths", { paths: event.payload.paths })
              .then((resolved) => {
                console.log("[useFileDrop] resolved", resolved.length, "files");
                if (resolved.length > 0) {
                  useFileStore.getState().addFiles(resolved);
                }
              })
              .catch((err) => {
                console.error("[useFileDrop] resolve_drop_paths failed:", err);
                setError(String(err));
              })
              .finally(() => {
                setDragState("idle");
              });
          }
        });
      } catch (e) {
        setError(String(e));
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return { dragState, error };
}
