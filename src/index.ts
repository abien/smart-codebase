import type { Plugin } from "@opencode-ai/plugin";
import { extractCommand } from "./commands/extract";
import { statusCommand } from "./commands/status";
import { rebuildIndexCommand } from "./commands/rebuild-index";
import { createContextInjectorHook } from "./hooks/context-injector";
import { createKnowledgeExtractorHook } from "./hooks/knowledge-extractor";
import { setPluginInput } from "./plugin-context";

const SmartCodebasePlugin: Plugin = async (input) => {
  setPluginInput(input);
  // 插件加载通知
  await input.client.tui.showToast({
    body: {
      title: "smart-codebase",
      message: "📚 插件已启用",
      variant: "info",
      duration: 3000,
    },
  }).catch(() => {});

  const contextInjector = createContextInjectorHook(input);
  const knowledgeExtractor = createKnowledgeExtractorHook(input);

  return {
    tool: {
      "sc-extract": extractCommand,
      "sc-status": statusCommand,
      "sc-rebuild-index": rebuildIndexCommand,
    },
    "tool.execute.after": async (hookInput, output) => {
      await contextInjector["tool.execute.after"]?.(hookInput, output);
      await knowledgeExtractor["tool.execute.after"]?.(hookInput, output);
    },
    event: async (hookInput) => {
      await contextInjector.event?.(hookInput);
      await knowledgeExtractor.event?.(hookInput);
    },
  };
};

export default SmartCodebasePlugin;
