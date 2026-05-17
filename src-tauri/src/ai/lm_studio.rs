use crate::ai::openai;
use crate::extractors::MediaInput;
use crate::models::AiResponse;
use reqwest::Client;

pub async fn call(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    model: &str,
    file_name: &str,
    user_prompt: &str,
    options_system: &str,
    media: &[MediaInput],
) -> Result<AiResponse, String> {
    openai::call(
        client,
        endpoint,
        api_key,
        model,
        file_name,
        user_prompt,
        options_system,
        media,
    )
    .await
}
