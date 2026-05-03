export declare function getDb(): Promise<any>;
export declare function saveDb(): void;
export declare function getRecentMergedPRs(sinceIso: any): Promise<any[]>;
export declare function getIssuesByNumbers(numbers: any): Promise<any[]>;
export declare function getTrendingOpenIssues(labels?: any[], limit?: number): Promise<any[]>;
export declare function getSyncState(key: any): Promise<any>;
export declare function setSyncState(key: any, value: any): Promise<void>;
export declare function getDbStats(): Promise<{
    openIssues: any;
    totalPRs: any;
    lastSync: any;
}>;
export declare function upsertIssue(issue: any): Promise<void>;
export declare function upsertPR(pr: any): Promise<void>;
