import { CONFIG } from "../config.js";
export async function callLLM(prompt) {
    if (CONFIG.llm.provider === "anthropic") {
        return callClaude(prompt);
    }
    return callOllama(prompt);
}
async function callOllama(prompt) {
    const response = await fetch(`${CONFIG.llm.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: CONFIG.llm.model,
            prompt,
            stream: false,
            think: CONFIG.llm.think,
            options: CONFIG.llm.options,
        }),
    });
    if (!response.ok)
        throw new Error(`Ollama error: ${await response.text()}`);
    const data = await response.json();
    return data.response;
}
async function callClaude(prompt) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": CONFIG.llm.apiKey,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        }),
    });
    if (!response.ok)
        throw new Error(`Claude error: ${await response.text()}`);
    const data = await response.json();
    return data.content[0].text;
}
