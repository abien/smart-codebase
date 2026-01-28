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
    config: async (config) => {
      config.command = {
        ...config.command,
        "sc-extract": {
          template: "使用 sc-extract 工具手动触发知识提取。分析当前会话中修改的文件，提取有价值的知识点。",
          description: "手动触发知识提取",
        },
        "sc-status": {
          template: "使用 sc-status 工具显示知识库的当前状态。包括知识点数量、链接数量等统计信息。",
          description: "显示知识库状态",
        },
        "sc-rebuild-index": {
          template: "使用 sc-rebuild-index 工具重建全局知识索引。扫描所有 .knowledge/ 目录并重新建立链接。",
          description: "重建知识索引",
        },
      };
    },
  };
};

export default SmartCodebasePlugin;
