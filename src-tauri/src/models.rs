use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameSuggestion {
    pub file_id: String,
    pub original_name: String,
    pub suggested_name: String,
    pub final_name: String,
    pub confidence: Option<f64>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameOperation {
    pub file_id: String,
    pub from_path: String,
    pub to_path: String,
    pub original_name: String,
    pub new_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameResult {
    pub success: Vec<RenameOperation>,
    pub failed: Vec<RenameFailed>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameFailed {
    pub operation: RenameOperation,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndoResult {
    pub restored: usize,
    pub failed: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameHistory {
    pub id: String,
    pub created_at: String,
    pub operations: Vec<RenameOperation>,
    pub success_count: usize,
    pub failed_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenameOptions {
    pub style: String,
    pub max_words: usize,
    pub language: String,
}

#[derive(Debug, Deserialize)]
pub struct AiResponse {
    pub name: Option<String>,
    pub reason: Option<String>,
}
