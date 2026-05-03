export declare function bootstrap(): Promise<{
    issueCount: number;
    prCount: number;
}>;
export declare function syncDelta(): Promise<{
    newPRs: number;
    newIssues: number;
    closedIssues: number;
    newlyMergedPRs: {
        url: string;
        id: number;
        node_id: string;
        html_url: string;
        diff_url: string;
        patch_url: string;
        issue_url: string;
        commits_url: string;
        review_comments_url: string;
        review_comment_url: string;
        comments_url: string;
        statuses_url: string;
        number: number;
        state: string;
        locked: boolean;
        title: string;
        user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        body: string | null;
        labels: {
            id: number;
            node_id: string;
            url: string;
            name: string;
            description: string;
            color: string;
            default: boolean;
        }[];
        milestone: import("@octokit/openapi-types").components["schemas"]["nullable-milestone"];
        active_lock_reason?: string | null;
        created_at: string;
        updated_at: string;
        closed_at: string | null;
        merged_at: string | null;
        merge_commit_sha: string | null;
        assignee: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        assignees?: import("@octokit/openapi-types").components["schemas"]["simple-user"][] | null;
        requested_reviewers?: import("@octokit/openapi-types").components["schemas"]["simple-user"][] | null;
        requested_teams?: import("@octokit/openapi-types").components["schemas"]["team"][] | null;
        head: {
            label: string;
            ref: string;
            repo: import("@octokit/openapi-types").components["schemas"]["repository"];
            sha: string;
            user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        };
        base: {
            label: string;
            ref: string;
            repo: import("@octokit/openapi-types").components["schemas"]["repository"];
            sha: string;
            user: import("@octokit/openapi-types").components["schemas"]["nullable-simple-user"];
        };
        _links: {
            comments: import("@octokit/openapi-types").components["schemas"]["link"];
            commits: import("@octokit/openapi-types").components["schemas"]["link"];
            statuses: import("@octokit/openapi-types").components["schemas"]["link"];
            html: import("@octokit/openapi-types").components["schemas"]["link"];
            issue: import("@octokit/openapi-types").components["schemas"]["link"];
            review_comments: import("@octokit/openapi-types").components["schemas"]["link"];
            review_comment: import("@octokit/openapi-types").components["schemas"]["link"];
            self: import("@octokit/openapi-types").components["schemas"]["link"];
        };
        author_association: import("@octokit/openapi-types").components["schemas"]["author-association"];
        auto_merge: import("@octokit/openapi-types").components["schemas"]["auto-merge"];
        draft?: boolean;
    }[];
}>;
