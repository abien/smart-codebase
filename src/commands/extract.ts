import { tool } from "@opencode-ai/plugin";

export const extractCommand = tool({
  description: "Manually trigger knowledge extraction from codebase",
  args: {},
  async execute() {
    return "Manual extraction not yet implemented. Use automatic extraction on session idle.";
  },
});
