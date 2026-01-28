import type { PluginInput, Hooks } from "@opencode-ai/plugin";
import type { PluginConfig } from "../types";
import { join } from "path";
import { 
  writeModuleSkill, 
  updateGlobalIndex, 
  getModulePath,
  toSkillName,
  type SkillContent,
  type IndexEntry
} from "../storage/knowledge-writer";
import { unwrapData, extractTextFromParts, withTimeout } from "../utils/sdk-helpers";
import { fileExists, readTextFile } from "../utils/fs-compat";
import { displayExtractionResult } from "../display/feedback";

type ToolExecuteAfterInput = Parameters<NonNullable<Hooks["tool.execute.after"]>>[0];
type ToolExecuteAfterOutput = Parameters<NonNullable<Hooks["tool.execute.after"]>>[1];
type EventInput = Parameters<NonNullable<Hooks["event"]>>[0];

const sessionDebounceTimers = new Map<string, NodeJS.Timeout>();
const sessionModifiedFiles = new Map<string, Set<string>>();
const sessionExtractionInProgress = new Map<string, boolean>();

function getModifiedFiles(sessionID: string): Set<string> {
  if (!sessionModifiedFiles.has(sessionID)) {
    sessionModifiedFiles.set(sessionID, new Set<string>());
  }
  return sessionModifiedFiles.get(sessionID)!;
}

export interface ExtractionResult {
  modulesUpdated: number;
  sectionsAdded: number;
  indexUpdated: boolean;
}

export async function extractKnowledge(
  ctx: PluginInput, 
  sessionID: string
): Promise<ExtractionResult> {
  if (sessionExtractionInProgress.get(sessionID)) {
    console.log(`[smart-codebase] Extraction already in progress for session ${sessionID}, skipping`);
    return { modulesUpdated: 0, sectionsAdded: 0, indexUpdated: false };
  }

  sessionExtractionInProgress.set(sessionID, true);

  let extractionSessionID: string | undefined;
  const result: ExtractionResult = { modulesUpdated: 0, sectionsAdded: 0, indexUpdated: false };

  try {
    const modifiedFiles = sessionModifiedFiles.get(sessionID);

    if (!modifiedFiles || modifiedFiles.size === 0) {
      console.log(`[smart-codebase] No files modified in session ${sessionID}, skipping extraction`);
      return result;
    }

    console.log(`[smart-codebase] Knowledge extraction triggered for session ${sessionID}`);
    console.log(`[smart-codebase] Modified files (${modifiedFiles.size}):`, Array.from(modifiedFiles));

    const messagesResult = await ctx.client.session.messages({
      path: { id: sessionID }
    });

    if (messagesResult.error) {
      console.error('[smart-codebase] Failed to fetch parent session messages:', messagesResult.error);
      return result;
    }

    const messages = messagesResult.data;
    const userMessages = messages
      .filter((msg: any) => msg.role === 'user')
      .map((msg: any) => {
        const textParts = msg.parts
          ?.filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n') || '';
        return textParts;
      })
      .filter((text: string) => text.length > 0);

    const createResult = await ctx.client.session.create({
      body: {
        title: 'Knowledge Extraction',
        parentID: sessionID,
      }
    });

    if (createResult.error) {
      console.error('[smart-codebase] Failed to create extraction session:', createResult.error);
      return result;
    }

    extractionSessionID = createResult.data.id;
    console.log(`[smart-codebase] Created extraction session: ${extractionSessionID}`);

    const modifiedFilesList = Array.from(modifiedFiles)
      .slice(0, 20)
      .map(f => `- ${f}`)
      .join('\n');

    const conversationContext = userMessages
      .map((msg: string, idx: number) => `[User message ${idx + 1}]\n${msg}`)
      .join('\n\n');

    const primaryFile = Array.from(modifiedFiles)[0];
    const primaryModulePath = getModulePath(primaryFile, ctx.directory);
    
    const existingSkillPath = join(ctx.directory, primaryModulePath, '.knowledge', 'SKILL.md');
    let existingSkillContent = '';
    if (await fileExists(existingSkillPath)) {
      existingSkillContent = await readTextFile(existingSkillPath);
      console.log(`[smart-codebase] Found existing SKILL.md at ${existingSkillPath}, will merge`);
    }

    const existingSkillSection = existingSkillContent 
      ? `\nEXISTING SKILL.md (merge with this):\n\`\`\`markdown\n${existingSkillContent}\n\`\`\`\n`
      : '\nNo existing SKILL.md found. Create new.\n';

    const systemContext = `You are extracting knowledge for a Claude Skill file (SKILL.md).

CONVERSATION HISTORY:
${conversationContext}

FILES MODIFIED:
${modifiedFilesList}
${existingSkillSection}
YOUR TASK:
1. Use Read tool to examine the modified files
2. Use git diff (via Bash) to see what changed
3. Extract knowledge that would help future AI sessions
4. If existing SKILL.md provided, MERGE new knowledge intelligently:
   - Preserve valuable existing content
   - Update outdated information with new learnings
   - Add new sections for new topics
   - Improve descriptions if new context makes them clearer
   - Remove redundant or contradictory content

OUTPUT FORMAT - Return JSON with COMPLETE merged content:
{
  "skill": {
    "modulePath": "src/invoice",
    "name": "invoice-processing",
    "description": "Handles invoice form validation and submission. Use when modifying invoice-related forms or validation logic.",
    "sections": [
      {
        "heading": "Form validation",
        "content": "Amount field uses Decimal type to avoid precision issues.\\nInvoice number format: INV-YYYYMMDD-XXXX"
      }
    ],
    "relatedFiles": ["src/invoice/form.tsx"]
  }
}

GUIDELINES:
- name: lowercase, hyphens only, max 64 chars (e.g., "invoice-processing")
- description: Third person, includes "Use when..." trigger. Max 200 chars.
- sections: COMPLETE list after merging. Include both existing and new sections.
- content: Use \\n for newlines. No verbose explanations. Concise, project-specific.
- relatedFiles: COMPLETE list after merging.

Return ONLY valid JSON. If no significant learnings: {"skill": null}`;

    const extractionPrompt = `Analyze the completed work and extract knowledge. Use Read and Bash tools to examine files and diffs.`;

    console.log(`[smart-codebase] Sending extraction prompt to AI...`);
    const promptResult = await withTimeout(
      ctx.client.session.prompt({
        path: { id: extractionSessionID },
        body: {
          system: systemContext,
          parts: [{ type: 'text', text: extractionPrompt }]
        }
      }),
      120000
    );

    const response = unwrapData(promptResult as any) as { parts: any[] };
    const text = extractTextFromParts(response.parts);
    console.log(`[smart-codebase] Received AI response (${text.length} chars)`);

    let extracted: { skill: any } | null = null;
    try {
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      extracted = JSON.parse(cleanText);
    } catch (error) {
      console.error('[smart-codebase] Failed to parse AI response as JSON:', error);
      return result;
    }

    if (!extracted?.skill) {
      console.log('[smart-codebase] No significant knowledge extracted');
      return result;
    }

    const s = extracted.skill;

    const skillContent: SkillContent = {
      metadata: {
        name: s.name || toSkillName(s.modulePath),
        description: s.description || `Handles ${s.modulePath} module. Use when working on related files.`
      },
      sections: (s.sections || []).map((sec: any) => ({
        heading: sec.heading,
        content: sec.content
      })),
      relatedFiles: s.relatedFiles || []
    };

    const skillPath = await writeModuleSkill(
      ctx.directory,
      s.modulePath || '.',
      skillContent
    );
    console.log(`[smart-codebase] Updated module skill: ${skillPath}`);
    result.modulesUpdated = 1;
    result.sectionsAdded = skillContent.sections.length;

    const indexEntry: IndexEntry = {
      name: skillContent.metadata.name,
      description: skillContent.metadata.description,
      location: `${s.modulePath || '.'}/.knowledge/SKILL.md`
    };

    await updateGlobalIndex(ctx.directory, indexEntry);
    console.log(`[smart-codebase] Updated global knowledge index`);
    result.indexUpdated = true;

    sessionModifiedFiles.delete(sessionID);

    return result;
  } catch (error) {
    console.error(`[smart-codebase] Failed to extract knowledge for session ${sessionID}:`, error);
    return result;
  } finally {
    sessionExtractionInProgress.delete(sessionID);

    if (extractionSessionID) {
      try {
        await ctx.client.session.delete({
          path: { id: extractionSessionID }
        });
        console.log(`[smart-codebase] Cleaned up extraction session: ${extractionSessionID}`);
      } catch (error) {
        console.error(`[smart-codebase] Failed to cleanup extraction session:`, error);
      }
    }
  }
}

export function createKnowledgeExtractorHook(ctx: PluginInput, config?: PluginConfig) {
  const FILE_MODIFICATION_TOOLS = [
    "write",
    "edit",
    "multiedit",
    "apply_patch",
    "ast_grep_replace",
    "lsp_rename",
  ];

  const toolExecuteAfter = async (
    input: ToolExecuteAfterInput,
    output: ToolExecuteAfterOutput,
  ) => {
    const toolName = input.tool.toLowerCase();

    if (FILE_MODIFICATION_TOOLS.includes(toolName)) {
      try {
        const filePath = output.title;

        if (filePath) {
          const modifiedFiles = getModifiedFiles(input.sessionID);
          modifiedFiles.add(filePath);
          console.log(`[smart-codebase] Tracked file modification: ${filePath} in session ${input.sessionID}`);
        }
      } catch (error) {
        console.error(`[smart-codebase] Failed to track file modification:`, error);
      }
    }
  };

  const eventHandler = async ({ event }: EventInput) => {
    const props = event.properties as Record<string, unknown> | undefined;

    if (event.type === "session.idle") {
      const sessionID = props?.sessionID as string | undefined;
      if (!sessionID) return;

      if (config?.autoExtract === false) {
        return;
      }

      const existingTimer = sessionDebounceTimers.get(sessionID);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const debounceMs = config?.debounceMs ?? 15000;
      const timer = setTimeout(async () => {
        const extractionResult = await extractKnowledge(ctx, sessionID);

        const message = displayExtractionResult(extractionResult);

        await ctx.client.tui.showToast({
          body: {
            title: "smart-codebase",
            message,
            variant: "success",
            duration: 5000,
          },
        }).catch(() => {});

        sessionDebounceTimers.delete(sessionID);
      }, debounceMs);

      sessionDebounceTimers.set(sessionID, timer);
      console.log(`[smart-codebase] Session ${sessionID} idle, extraction scheduled in ${debounceMs}ms`);
    }

    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined;
      if (sessionInfo?.id) {
        const timer = sessionDebounceTimers.get(sessionInfo.id);
        if (timer) {
          clearTimeout(timer);
        }
        sessionDebounceTimers.delete(sessionInfo.id);
        sessionModifiedFiles.delete(sessionInfo.id);
        console.log(`[smart-codebase] Cleaned up session ${sessionInfo.id}`);
      }
    }
  };

  return {
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  };
}
