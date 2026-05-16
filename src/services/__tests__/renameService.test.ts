import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  generateRenameSuggestions,
  renameFiles,
  undoLastRename,
} from "../renameService";
import type {
  RenameSuggestion,
  RenameOperation,
  RenameResult,
} from "../../types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("generateRenameSuggestions", () => {
  const input = {
    files: [
      { id: "1", path: "/dir/photo.jpg" },
      { id: "2", path: "/dir/doc.pdf" },
    ],
    provider: "openai-compatible",
    model: "gpt-4",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    prompt: "Rename files descriptively",
    options: { style: "snake_case", max_words: 5, language: "english" },
  };

  it("calls invoke with correct command and args", async () => {
    const expected: RenameSuggestion[] = [
      {
        fileId: "1",
        originalName: "photo.jpg",
        suggestedName: "vacation_photo",
        finalName: "vacation_photo.jpg",
      },
    ];
    mockInvoke.mockResolvedValue(expected);
    const result = await generateRenameSuggestions(input);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("generate_rename_suggestions", {
      files: input.files,
      provider: input.provider,
      model: input.model,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      prompt: input.prompt,
      options: input.options,
    });
    expect(result).toEqual(expected);
  });

  it("propagates errors from invoke", async () => {
    const err = new Error("API error");
    mockInvoke.mockRejectedValue(err);
    await expect(generateRenameSuggestions(input)).rejects.toThrow("API error");
  });
});

describe("renameFiles", () => {
  const operations: RenameOperation[] = [
    {
      fileId: "1",
      fromPath: "/dir/photo.jpg",
      toPath: "/dir/vacation_photo.jpg",
      originalName: "photo.jpg",
      newName: "vacation_photo.jpg",
    },
  ];

  it("calls invoke with correct command and args", async () => {
    const expected: RenameResult = {
      success: [
        {
          fileId: "1",
          fromPath: "/dir/photo.jpg",
          toPath: "/dir/vacation_photo.jpg",
          originalName: "photo.jpg",
          newName: "vacation_photo.jpg",
        },
      ],
      failed: [],
    };
    mockInvoke.mockResolvedValue(expected);
    const result = await renameFiles(operations);
    expect(mockInvoke).toHaveBeenCalledWith("rename_files", {
      operations,
    });
    expect(result).toEqual(expected);
  });

  it("propagates errors from invoke", async () => {
    const err = new Error("Rename failed");
    mockInvoke.mockRejectedValue(err);
    await expect(renameFiles(operations)).rejects.toThrow("Rename failed");
  });
});

describe("undoLastRename", () => {
  it("calls invoke with correct command", async () => {
    mockInvoke.mockResolvedValue({ restored: 1, failed: 0 });
    const result = await undoLastRename();
    expect(mockInvoke).toHaveBeenCalledWith("undo_last_rename", undefined);
    expect(result).toEqual({ restored: 1, failed: 0 });
  });

  it("propagates errors from invoke", async () => {
    const err = new Error("Nothing to undo");
    mockInvoke.mockRejectedValue(err);
    await expect(undoLastRename()).rejects.toThrow("Nothing to undo");
  });
});
