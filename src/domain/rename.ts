export const FILENAME_STYLES = {
  "kebab-case": "kebab-case",
  snake_case: "snake_case",
  "title-case": "Title Case",
  camelCase: "camelCase",
} as const;

export type FilenameStyle = keyof typeof FILENAME_STYLES;

export function applyFilenameStyle(name: string, style: FilenameStyle): string {
  const words = name.split(/\s+/);
  switch (style) {
    case "snake_case":
      return words.map((w) => w.toLowerCase()).join("_");
    case "title-case":
      return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    case "camelCase":
      return words
        .map((w, i) =>
          i === 0
            ? w.toLowerCase()
            : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
        )
        .join("");
    default:
      return words.map((w) => w.toLowerCase()).join("-");
  }
}
