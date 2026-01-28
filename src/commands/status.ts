import { tool } from "@opencode-ai/plugin";

export const statusCommand = tool({
  description: "Display smart-codebase knowledge base status",
  args: {},
  async execute() {
    return "Knowledge base status: Feature in development";
  },
});
