import { useSettingsStore } from "../stores/settingsStore";

export function ControlBar() {
  const settings = useSettingsStore();

  function handleModelChange(e: React.ChangeEvent<HTMLSelectElement>) {
    settings.setActiveModel(e.target.value);
    settings.persistProviders();
  }

  return (
    <div className="control-bar">
      <div>
        <div className="field-title">Model</div>
        <select
          className="control-select"
          value={settings.activeModelId}
          onChange={handleModelChange}
        >
          {settings.providers.filter((p) => p.models.length > 0).length ===
            0 && <option value="">No models available</option>}
          {settings.providers
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
