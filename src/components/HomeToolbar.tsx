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
  const autoRenameAll = useWorkflowStore((s) => s.autoRenameAll);
  const renaming = useWorkflowStore((s) => s.renaming);
  const cancelAllOperations = useWorkflowStore(
    (s) => s.cancelAllOperations,
  );
  const autoAccept = useWorkflowStore((s) => s.autoAccept);
  const toggleAutoAccept = useWorkflowStore((s) => s.toggleAutoAccept);

  const hasSuggestions =
    generateStatus === "ready" && Object.keys(suggestions).length > 0;
  const selectedCount = [...selectedIds].filter(
    (id) => suggestions[id],
  ).length;

  const isLocked = generateStatus === "generating" || renaming;

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
            <label className="auto-toggle" title="Auto-rename each file as suggestion arrives">
              <input
                type="checkbox"
                checked={autoAccept}
                onChange={toggleAutoAccept}
              />
              Auto
            </label>
            {!autoAccept && hasSuggestions && (
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
                autoAccept
                  ? autoRenameAll
                  : hasSuggestions
                    ? onRename
                    : generateAllSuggestions
              }
              disabled={
                generateStatus === "generating" ||
                renaming ||
                (!autoAccept && hasSuggestions && selectedCount === 0)
              }
            >
              {generateStatus === "generating" || renaming
                ? autoAccept
                  ? "Auto Renaming..."
                  : "Generating..."
                : autoAccept
                  ? "⟳ Auto Rename"
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
