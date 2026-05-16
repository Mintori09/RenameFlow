import { useEffect, useRef } from "react";
import { useFileStore } from "../stores/fileStore";
import { useWorkflowStore } from "../stores/workflowStore";

type HomeToolbarProps = {
  onRename: () => void;
};

export function HomeToolbar({ onRename }: HomeToolbarProps) {
  const suggestions = useFileStore((s) => s.suggestions);
  const generateStatus = useFileStore((s) => s.generateStatus);
  const errorMessage = useFileStore((s) => s.errorMessage);
  const selectedIds = useFileStore((s) => s.selectedIds);
  const generateAllSuggestions = useWorkflowStore(
    (s) => s.generateAllSuggestions,
  );
  const renaming = useWorkflowStore((s) => s.renaming);
  const cancelAllOperations = useWorkflowStore(
    (s) => s.cancelAllOperations,
  );
  const autoAccept = useWorkflowStore((s) => s.autoAccept);
  const toggleAutoAccept = useWorkflowStore((s) => s.toggleAutoAccept);

  const prevStatusRef = useRef(generateStatus);
  useEffect(() => {
    if (generateStatus === "ready" && autoAccept && prevStatusRef.current === "generating") {
      onRename();
    }
    prevStatusRef.current = generateStatus;
  }, [generateStatus, autoAccept, onRename]);

  const hasSuggestions =
    generateStatus === "ready" && Object.keys(suggestions).length > 0;
  const selectedCount = [...selectedIds].filter(
    (id) => suggestions[id],
  ).length;

  const isLocked = generateStatus === "generating";

  return (
    <>
      <div className="top-card">
        <div className="breadcrumb">
          <div className="crumb">
            <span>Home</span>
            <span>/</span>
            <span>Rename</span>
          </div>
          <div className="top-actions">
            <label className="auto-toggle" title="Auto-rename files after generation">
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={toggleAutoAccept}
              />
              Auto
            </label>
            {hasSuggestions && (
              <button
                className="btn"
                onClick={generateAllSuggestions}
              >
                ⟳ Regenerate All
              </button>
            )}
            <button
              className="btn primary"
              onClick={
                hasSuggestions ? onRename : generateAllSuggestions
              }
              disabled={
                generateStatus === "generating" ||
                renaming ||
                (hasSuggestions && selectedCount === 0)
              }
            >
              {generateStatus === "generating"
                ? "Generating..."
                : renaming
                  ? "Renaming..."
                  : hasSuggestions
                    ? `⟳ Rename Selected (${selectedCount})`
                    : "Generate Names"}
            </button>
            {isLocked && (
              <button
                className="btn btn-cancel"
                onClick={cancelAllOperations}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">{errorMessage}</div>
      )}
    </>
  );
}
