export type FileStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "renamed"
  | "failed";

export type FileItem = {
  id: string;
  path: string;
  directory: string;
  originalName: string;
  extension: string;
  size: number;
  mimeType?: string;
  thumbnailPath?: string;
  status: FileStatus;
  error?: string;
};

export type FileWithSuggestion = FileItem & {
  suggestion?: {
    finalName: string;
    suggestedName: string;
    confidence?: number;
    reason?: string;
  };
};
