import { useSettingsStore } from "../stores/settingsStore";

export function ControlBar() {
  const activeModelId = useSettingsStore((s) => s.activeModelId);
  const providers = useSettingsStore((s) => s.providers);
  const setActiveModel = useSettingsStore((s) => s.setActiveModel);
  const persistProviders = useSettingsStore((s) => s.persistProviders);

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setActiveModel(e.target.value);
    persistProviders();
  }

  return (
    <div className="control-bar">
      <div>
        <div className="field-title">Model</div>
        <select
          className="control-select"
          value={activeModelId}
          onChange={handleModelChange}
        >
          {providers.filter((p) => p.models.length > 0).length ===
            0 && <option value="">No models available</option>}
          {providers
            .filter((p) => p.models.length > 0)
            .map((p) =>
              p.models.map((m) => {
                const id = `${p.name}::${m}`;
                return (
                  <option key={id} value={id}>
                    {m} — {p.name}
                  </option>
                );
              }),
            )}
        </select>
      </div>
    </div>
  );
}
