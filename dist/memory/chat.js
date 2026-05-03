import fs from "fs";
import path from "path";
import { CONFIG } from "../config.js";
const CHAT_PATH = path.join(CONFIG.dataDir, "chat.json");
function loadRaw() {
    if (!fs.existsSync(CHAT_PATH)) {
        return { window_size: CONFIG.limits.chatHistory, exchanges: [] };
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(CHAT_PATH, "utf-8"));
        if (Array.isArray(parsed)) {
            return {
                window_size: CONFIG.limits.chatHistory,
                exchanges: parsed.map(ex => ({
                    run_id: ex.date ?? new Date().toISOString(),
                    summary_sent: (ex.summary ?? "").slice(0, 600),
                    user_reply: ex.userReply ?? null,
                    recorded_at: ex.date ?? new Date().toISOString(),
                })),
            };
        }
        if (!Array.isArray(parsed.exchanges))
            parsed.exchanges = [];
        if (!parsed.window_size)
            parsed.window_size = CONFIG.limits.chatHistory;
        return parsed;
    }
    catch {
        return { window_size: CONFIG.limits.chatHistory, exchanges: [] };
    }
}
function saveRaw(data) {
    fs.mkdirSync(path.dirname(CHAT_PATH), { recursive: true });
    const tmpPath = CHAT_PATH + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, CHAT_PATH);
}
export function loadChatHistory() {
    return loadRaw();
}
export function appendExchange({ runId, summarySent, userReply = null }) {
    const history = loadRaw();
    history.exchanges.push({
        run_id: runId,
        summary_sent: summarySent.slice(0, 600),
        user_reply: userReply,
        recorded_at: new Date().toISOString(),
    });
    if (history.exchanges.length > history.window_size) {
        history.exchanges = history.exchanges.slice(-history.window_size);
    }
    saveRaw(history);
}
export function appendReplyToLastExchange(replyText) {
    const history = loadRaw();
    if (!history.exchanges.length)
        return;
    const last = [...history.exchanges].reverse().find(ex => !ex.user_reply);
    if (last) {
        last.user_reply = replyText.slice(0, 500);
    }
    saveRaw(history);
}
export function formatChatForPrompt(history) {
    if (!history?.exchanges?.length)
        return "";
    const relevant = history.exchanges;
    const directives = relevant
        .filter(ex => ex.user_reply && ex.user_reply.trim().length > 2)
        .map((ex, i) => `- [Run ${ex.run_id?.slice(0, 10) ?? i}] "${ex.user_reply}"`);
    const contextLines = relevant.map((ex, i) => {
        const reply = ex.user_reply
            ? `  User replied: "${ex.user_reply}"`
            : `  (no reply)`;
        return `Run ${i + 1} (${ex.run_id?.slice(0, 10) ?? "unknown"}): ${ex.summary_sent?.slice(0, 150) ?? ""}...\n${reply}`;
    });
    const directiveSection = directives.length
        ? `\n⚠️ MANDATORY INSTRUCTIONS — YOU MUST FOLLOW THESE EXACTLY, OVERRIDING ALL OTHER DEFAULTS:\n${directives.join("\n")}\n`
        : "";
    return `
PREVIOUS DIGEST CONTEXT (last ${relevant.length} runs):
${contextLines.join("\n\n")}
${directiveSection}`.trim();
}
export function getHardcodedUserReply() {
    return "Good summary. I'm particularly interested in the identity-oci-auth and identity-azure-auth services. Please focus on those in future summaries if they appear.";
}
export function getLastSavedReply() {
    const history = loadRaw();
    if (!history.exchanges?.length)
        return null;
    const last = history.exchanges[history.exchanges.length - 1];
    if (last?.user_reply && last.user_reply.trim().length > 2) {
        return last.user_reply;
    }
    return null;
}
