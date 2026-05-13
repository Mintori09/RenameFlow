import { useSettingsStore } from "../stores/settingsStore";

export function SettingsSection() {
  const settings = useSettingsStore();

  return (
    <div className="section">
      <h2 className="section-title">Settings</h2>
      <div className="settings-form">
        <div className="config-group">
          <label className="config-label">Provider</label>
          <select
            className="config-select"
            value={settings.provider}
            onChange={(e) =>
              settings.updateSettings({ provider: e.target.value as any })
            }
          >
            <option value="ollama">Ollama</option>
            <option value="lm-studio">LM Studio</option>
          </select>
        </div>

        <div className="config-group">
          <label className="config-label">Ollama / LM Studio URL</label>
          <input
            className="config-input"
            type="text"
            value={settings.baseUrl}
            onChange={(e) =>
              settings.updateSettings({ baseUrl: e.target.value })
            }
          />
        </div>

        <div className="config-group">
          <label className="config-label">Filename Style</label>
          <select
            className="config-select"
            value={settings.style}
            onChange={(e) =>
              settings.updateSettings({ style: e.target.value as any })
            }
          >
            <option value="kebab-case">kebab-case</option>
            <option value="snake_case">snake_case</option>
            <option value="title-case">Title Case</option>
            <option value="camelCase">camelCase</option>
          </select>
        </div>

        <div className="config-group">
          <label className="config-label">Max Words</label>
          <input
            className="config-input"
            type="number"
            value={settings.maxWords}
            onChange={(e) =>
              settings.updateSettings({
                maxWords: parseInt(e.target.value) || 8,
              })
            }
            min={1}
            max={20}
          />
        </div>

        <div className="config-group">
          <label className="config-label">Language</label>
          <select
            className="config-select"
            value={settings.language}
            onChange={(e) =>
              settings.updateSettings({ language: e.target.value as any })
            }
          >
            <option value="english">English</option>
            <option value="vietnamese">Vietnamese</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>
    </div>
  );
}
