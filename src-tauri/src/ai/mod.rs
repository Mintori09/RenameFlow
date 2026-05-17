pub mod anthropic;
pub mod google;
pub mod lm_studio;
pub mod ollama;
pub mod openai;
pub mod parser;
pub mod provider;

pub use crate::extractors::MediaInput;
pub use provider::{generate_name, AiProvider};

