# smart-codebase

OpenCode plugin that automatically extracts and maintains project knowledge from AI coding sessions.

## How It Works

```
Session ends → Plugin analyzes changes → Extracts knowledge → Updates SKILL.md
                                                                    ↓
New session starts → AI reads KNOWLEDGE.md → Finds relevant skills → Reads SKILL.md
```

Knowledge is stored in Claude Skill format - Markdown files with YAML frontmatter that AI can discover and read autonomously.

## File Structure

```
project/
├── KNOWLEDGE.md                    # Global index (AI reads this first)
│
├── src/auth/.knowledge/
│   └── SKILL.md                    # Module-specific knowledge
│
├── src/payments/.knowledge/
│   └── SKILL.md
```

### SKILL.md Format

```markdown
---
name: auth-module
description: Handles user authentication. Use when modifying login, session, or JWT logic.
---

## Session handling
Sessions expire after 24h. Refresh tokens stored in httpOnly cookies.

## Related files
- `src/auth/session.ts`
- `src/auth/jwt.ts`
```

## Features

- **Auto-extraction**: Triggers 15s after session goes idle (configurable)
- **AI-powered merge**: When updating existing skills, AI intelligently merges new knowledge with existing content
- **Progressive disclosure**: AI reads global index first, then relevant module skills as needed
- **Version controlled**: All knowledge stored as Markdown in your repo

## Installation

```bash
bun add smart-codebase
```

Add to `opencode.json`:

```json
{
  "plugin": ["smart-codebase"]
}
```

Or install locally:

```bash
bun run build
cp -r dist/* /path/to/project/.opencode/plugins/
```

## Commands

| Command | Description |
|---------|-------------|
| `/sc-status` | Show knowledge base status |
| `/sc-extract` | Manually trigger extraction |
| `/sc-rebuild-index` | Rebuild KNOWLEDGE.md from all SKILL.md files |

## Configuration

Create `smart-codebase.json` in your project root:

```json
{
  "enabled": true,
  "debounceMs": 15000,
  "autoExtract": true,
  "autoInject": true,
  "disabledCommands": []
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable the plugin |
| `debounceMs` | `15000` | Wait time after idle before extraction (ms) |
| `autoExtract` | `true` | Enable automatic knowledge extraction |
| `autoInject` | `true` | Inject knowledge hint at session start |
| `disabledCommands` | `[]` | Commands to disable, e.g. `["sc-extract", "sc-status"]` |

All options are optional. Missing options use defaults.

## Development

```bash
bun install
bun run build
bun run typecheck
```

## License

MIT
