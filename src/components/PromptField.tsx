import { useSettingsStore } from "../stores/settingsStore";

export function PromptField() {
  const prompt = useSettingsStore((s) => s.prompt);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  return (
    <div className="prompt-field">
      <label className="config-label">Prompt</label>
      <textarea
        className="prompt-textarea"
        value={prompt}
        onChange={(e) => updateSettings({ prompt: e.target.value })}
        placeholder="Describe how files should be renamed..."
        rows={2}
      />
    </div>
  );
}
