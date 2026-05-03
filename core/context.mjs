import { getRecentMergedPRs, getIssuesByNumbers, getTrendingOpenIssues } from "../memory/db.mjs";
import { loadMotive, formatMotiveForPrompt } from "../memory/motive.mjs";
import { loadChatHistory, formatChatForPrompt } from "../memory/chat.mjs";
import { CONFIG } from "../config.mjs";

export async function buildPrompt(deltaResult) {
  const since = new Date(Date.now() - CONFIG.limits.lookbackHours * 3600_000).toISOString();

  const motive = loadMotive();
  const chatHistory = loadChatHistory();

  const mergedPRs = await getRecentMergedPRs(since);

  const allLinkedIds = [...new Set(mergedPRs.flatMap(pr => pr.linked_issue_ids))];
  const linkedIssues = await getIssuesByNumbers(allLinkedIds.slice(0, CONFIG.limits.linkedIssues));

  const allLabels = [...new Set(mergedPRs.flatMap(pr => pr.labels))];
  const trendingIssues = await getTrendingOpenIssues(allLabels, CONFIG.limits.trendingIssues);

  const prSection = mergedPRs.length
    ? mergedPRs.map(pr => `  PR #${pr.number} "${pr.title}" by @${pr.author}
    Labels: ${pr.labels.join(", ") || "none"}
    Areas: ${pr.changed_areas.join(", ") || "unknown"}
    Linked issues: ${pr.linked_issue_ids.length ? "#" + pr.linked_issue_ids.join(", #") : "none"}
    ${pr.key_comment ? `Key comment: "${pr.key_comment.slice(0, 200)}"` : ""}
    Snippet: ${pr.body_snippet.slice(0, 200)}`).join("\n\n")
    : "  None in this window.";

  const linkedSection = linkedIssues.length
    ? linkedIssues.map(i => `  #${i.number} [${i.state}] "${i.title}" — labels: ${i.labels.join(", ")} | reactions: ${i.reactions}`).join("\n")
    : "  None directly linked.";

  const trendingSection = trendingIssues.length
    ? trendingIssues.map(i => `  #${i.number} "${i.title}" — labels: ${i.labels.join(", ")} | reactions: ${i.reactions} | comments: ${i.comment_count}`).join("\n")
    : "  None.";

  const chatSection = formatChatForPrompt(chatHistory);
  const motiveSection = formatMotiveForPrompt(motive);

  // Extract latest directive for reminder at bottom of prompt
  const latestDirective = chatHistory.exchanges
    ?.filter(ex => ex.user_reply?.trim().length > 2)
    ?.at(-1)?.user_reply ?? null;

  const directiveReminder = latestDirective
    ? `\n⚠️ REMINDER: The contributor's latest instruction was: "${latestDirective}". Prioritize this above everything else in your response.\n`
    : "";

  return `
You are a repo intelligence assistant for open-source contributors.
Your job is to analyze recent repository activity and produce a structured digest
that helps a contributor decide what to work on next.

${motiveSection}

${chatSection ? chatSection + "\n" : ""}
---

TODAY'S MERGED PULL REQUESTS (last ${CONFIG.limits.lookbackHours}h):
${prSection}

ISSUES DIRECTLY RESOLVED BY TODAY'S PRs:
${linkedSection}

TRENDING OPEN ISSUES (same areas as today's PRs, sorted by community interest):
${trendingSection}

---
${directiveReminder}
Generate a structured digest with EXACTLY these four sections:

1. ACTIVE SUBSYSTEMS
   Which areas of the codebase saw the most activity today, and what does it signal about current priorities?

2. ISSUES RESOLVED TODAY
   Which specific issues were closed/fixed by today's PRs? What problem did each solve?

3. RELATED OPEN ISSUES
   Which open issues are closely related to today's work and still need attention?

4. CONTRIBUTION OPPORTUNITIES FOR THIS CONTRIBUTOR
   Based on the contributor profile above and today's activity, suggest 2-3 specific issues to work on.
   For each: issue number, title, why it matches their profile, and what approach to take.
   Be specific — not "this could be interesting" but "this is a good fit because X and here's how to start."

Keep the total response under 600 words. Be direct and specific, not generic.
  `.trim();
}