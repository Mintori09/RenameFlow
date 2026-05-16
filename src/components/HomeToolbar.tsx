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

  const hasSuggestions =
    generateStatus === "ready" && Object.keys(suggestions).length > 0;
  const selectedCount = [...selectedIds].filter(
    (id) => suggestions[id],
  ).length;

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
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="error-banner">{errorMessage}</div>
      )}
    </>
  );
}
