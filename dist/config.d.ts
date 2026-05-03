export declare const CONFIG: {
    repo: {
        owner: string;
        name: string;
    };
    github: {
        token: string;
    };
    delivery: string;
    telegram: {
        token: string;
        chatId: string;
    };
    llm: {
        provider: string;
        model: string;
        baseUrl: string;
        think: boolean;
        apiKey: string;
        options: {
            temperature: number;
        };
    };
    limits: {
        maxIssues: number;
        maxPRs: number;
        lookbackHours: number;
        trendingIssues: number;
        linkedIssues: number;
        chatHistory: number;
    };
    dataDir: string;
};
