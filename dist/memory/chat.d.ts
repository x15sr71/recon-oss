export declare function loadChatHistory(): any;
export declare function appendExchange({ runId, summarySent, userReply }: {
    runId: any;
    summarySent: any;
    userReply?: any;
}): void;
export declare function appendReplyToLastExchange(replyText: any): void;
export declare function formatChatForPrompt(history: any): string;
export declare function getHardcodedUserReply(): string;
export declare function getLastSavedReply(): any;
