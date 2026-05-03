import readline from "readline";
export async function send(text) {
    console.log("\n" + "─".repeat(55));
    console.log("📋 DIGEST\n");
    console.log(text);
    console.log("─".repeat(55) + "\n");
}
export async function captureReply() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question("💬 Any feedback for next run? (press Enter to skip): ", (answer) => {
            rl.close();
            resolve(answer.trim() || null);
        });
    });
}
