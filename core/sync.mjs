import { Octokit } from "@octokit/rest";
import { CONFIG } from "../config.mjs";
import {
  upsertIssue, upsertPR,
  getSyncState, setSyncState, saveDb,
} from "../memory/db.mjs";

const octokit = new Octokit({ auth: CONFIG.github.token });
const { owner, name: repo } = CONFIG.repo;

function parseLinkedIssues(body = "") {
  const pattern = /(?:fixes|closes|resolves|fix|close|resolve)\s+#(\d+)/gi;
  const ids = [];
  let match;
  while ((match = pattern.exec(body)) !== null) {
    ids.push(parseInt(match[1], 10));
  }
  return [...new Set(ids)];
}

async function getChangedAreas(prNumber) {
  try {
    const { data: files } = await octokit.pulls.listFiles({
      owner, repo, pull_number: prNumber, per_page: 50,
    });
    const areas = new Set(
      files.map(f => f.filename.split("/").slice(0, 3).join("/"))
    );
    return [...areas].slice(0, 8);
  } catch {
    return [];
  }
}

async function getKeyComment(prNumber) {
  try {
    const { data: comments } = await octokit.issues.listComments({
      owner, repo, issue_number: prNumber, per_page: 20,
    });
    const meaningful = comments.find(c =>
      !c.user.login.includes("[bot]") &&
      !c.user.login.includes("bot") &&
      c.body.length > 30
    );
    return meaningful?.body?.slice(0, 300) ?? "";
  } catch {
    return "";
  }
}

export async function bootstrap() {
  console.log(`  [sync] Bootstrapping — fetching up to ${CONFIG.limits.maxIssues} issues and ${CONFIG.limits.maxPRs} PRs...`);

  let issueCount = 0;
  let page = 1;
  while (issueCount < CONFIG.limits.maxIssues) {
    const { data: issues } = await octokit.issues.listForRepo({
      owner, repo, state: "open", per_page: 100, page,
      sort: "updated", direction: "desc",
    });
    if (!issues.length) break;

    for (const issue of issues) {
      if (issue.pull_request) continue;
      await upsertIssue({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        body_snippet: (issue.body ?? "").slice(0, 500),
        comment_count: issue.comments,
        reactions: issue.reactions?.total_count ?? 0,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        linked_pr_numbers: [],
      });
      issueCount++;
    }
    if (issues.length < 100) break;
    page++;
  }
  console.log(`  [sync] Bootstrapped ${issueCount} issues.`);

  let prCount = 0;
  page = 1;
  while (prCount < CONFIG.limits.maxPRs) {
    const { data: prs } = await octokit.pulls.list({
      owner, repo, state: "closed", per_page: 50, page,
      sort: "updated", direction: "desc",
    });
    if (!prs.length) break;

    const merged = prs.filter(pr => pr.merged_at);
    for (const pr of merged) {
      const linkedIds = parseLinkedIssues(pr.body ?? "");
      const changedAreas = await getChangedAreas(pr.number);
      await upsertPR({
        number: pr.number,
        title: pr.title,
        labels: pr.labels.map(l => l.name),
        author: pr.user?.login ?? "",
        merged_at: pr.merged_at,
        body_snippet: (pr.body ?? "").slice(0, 400),
        changed_areas: changedAreas,
        linked_issue_ids: linkedIds,
        key_comment: "",
      });
      prCount++;
    }
    if (prs.length < 50) break;
    page++;
  }
  console.log(`  [sync] Bootstrapped ${prCount} merged PRs.`);

  await setSyncState("last_sync", new Date().toISOString());
  saveDb();
  return { issueCount, prCount };
}

export async function syncDelta() {
  const lastSync = await getSyncState("last_sync");
  const since = lastSync ?? new Date(Date.now() - 24 * 3600_000).toISOString();
  console.log(`  [sync] Delta sync since ${since}...`);

  let newIssues = 0, closedIssues = 0, newPRs = 0;

  const { data: changedIssues } = await octokit.issues.listForRepo({
    owner, repo, state: "all", since, per_page: 100,
    sort: "updated", direction: "desc",
  });

  for (const issue of changedIssues) {
    if (issue.pull_request) continue;
    await upsertIssue({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels.map(l => l.name),
      body_snippet: (issue.body ?? "").slice(0, 500),
      comment_count: issue.comments,
      reactions: issue.reactions?.total_count ?? 0,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at,
      linked_pr_numbers: [],
    });
    if (issue.state === "closed") closedIssues++;
    else newIssues++;
  }

  const lookback = new Date(Date.now() - CONFIG.limits.lookbackHours * 3600_000).toISOString();
  const { data: recentPRs } = await octokit.pulls.list({
    owner, repo, state: "closed", per_page: 50,
    sort: "updated", direction: "desc",
  });

  const newlyMerged = recentPRs.filter(pr =>
    pr.merged_at && pr.merged_at >= lookback
  );

  for (const pr of newlyMerged) {
    const linkedIds = parseLinkedIssues(pr.body ?? "");
    const changedAreas = await getChangedAreas(pr.number);
    const keyComment = await getKeyComment(pr.number);
    await upsertPR({
      number: pr.number,
      title: pr.title,
      labels: pr.labels.map(l => l.name),
      author: pr.user?.login ?? "",
      merged_at: pr.merged_at,
      body_snippet: (pr.body ?? "").slice(0, 400),
      changed_areas: changedAreas,
      linked_issue_ids: linkedIds,
      key_comment: keyComment,
    });
    newPRs++;
  }

  await setSyncState("last_sync", new Date().toISOString());
  saveDb();
  console.log(`  [sync] Delta: +${newPRs} PRs, +${newIssues} issues updated, ${closedIssues} closed.`);
  return { newPRs, newIssues, closedIssues, newlyMergedPRs: newlyMerged };
}