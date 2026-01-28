import { tool } from "@opencode-ai/plugin";

export const rebuildIndexCommand = tool({
  description: "Rebuild global knowledge base index",
  args: {},
  async execute() {
    return "Index rebuild not yet implemented";
  },
});
