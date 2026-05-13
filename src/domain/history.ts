export type RenameHistoryEntry = {
  id: string;
  createdAt: string;
  operations: Array<{
    fileId: string;
    fromPath: string;
    toPath: string;
    originalName: string;
    newName: string;
  }>;
  successCount: number;
  failedCount: number;
};

export function formatHistoryDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
