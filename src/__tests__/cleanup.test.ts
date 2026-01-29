import { test, expect } from "bun:test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { writeTextFile, fileExists } from "../utils/fs-compat";
import { cleanupCommand } from "../commands/cleanup";
import { mkdir } from "fs/promises";

function createMockContext(tmpDir: string): any {
  return {
    directory: tmpDir,
    worktree: tmpDir,
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    abort: new AbortController().signal,
    metadata: () => {},
  };
}

/**
 * TDD RED Phase: Tests for cleanup command
 * 
 * These tests define expected behavior BEFORE implementation:
 * 1. Preview mode: Lists eligible skills without deleting
 * 2. Confirm mode: Deletes files and updates main index
 * 3. Cleanup criteria uses AND logic (all conditions must be met)
 * 4. Custom thresholds from config are respected
 * 5. Empty result when no files are eligible
 */

test("cleanup: preview mode lists eligible skills without deleting", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const modulesDir = join(tmpDir, ".opencode", "skills", "test-project", "modules");
    await mkdir(modulesDir, { recursive: true });
    
    // Create old, low-usage skill (eligible)
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const oldSkillPath = join(modulesDir, "src-old.md");
    await writeTextFile(oldSkillPath, `---
name: src-old
description: Old module
usage:
  created_at: ${oldDate}
  last_accessed: ${oldDate}
  access_count: 2
  last_updated: ${oldDate}
---

# Old Module
Content here
`);
    
    // Create new skill (not eligible - too young)
    const newDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const newSkillPath = join(modulesDir, "src-new.md");
    await writeTextFile(newSkillPath, `---
name: src-new
description: New module
usage:
  created_at: ${newDate}
  last_accessed: ${newDate}
  access_count: 1
  last_updated: ${newDate}
---

# New Module
Content here
`);
    
    // Execute command in preview mode (default)
    const ctx = createMockContext(tmpDir);
    const result = await cleanupCommand.execute({}, ctx);
    
    // Verify result includes eligible skill
    expect(result).toContain("src-old");
    expect(result).not.toContain("src-new");
    expect(result).toContain("Run with --confirm to delete");
    
    // Verify files still exist (not deleted in preview mode)
    expect(await fileExists(oldSkillPath)).toBe(true);
    expect(await fileExists(newSkillPath)).toBe(true);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("cleanup: confirm mode deletes eligible skills", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const modulesDir = join(tmpDir, ".opencode", "skills", "test-project", "modules");
    await mkdir(modulesDir, { recursive: true });
    
    // Create old, low-usage skill (eligible)
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const oldSkillPath = join(modulesDir, "src-old.md");
    await writeTextFile(oldSkillPath, `---
name: src-old
description: Old module
usage:
  created_at: ${oldDate}
  last_accessed: ${oldDate}
  access_count: 2
  last_updated: ${oldDate}
---

# Old Module
Content here
`);
    
    // Execute command in confirm mode
    const ctx = createMockContext(tmpDir);
    const result = await cleanupCommand.execute({ confirm: true }, ctx);
    
    // Verify result confirms deletion
    expect(result).toContain("Deleted");
    expect(result).toContain("src-old");
    
    // Verify file was actually deleted
    expect(await fileExists(oldSkillPath)).toBe(false);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("cleanup: confirm mode updates main index (removes deleted entries)", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const skillDir = join(tmpDir, ".opencode", "skills", "test-project");
    const modulesDir = join(skillDir, "modules");
    await mkdir(modulesDir, { recursive: true });
    
    // Create main index with entry
    const indexPath = join(skillDir, "SKILL.md");
    await writeTextFile(indexPath, `---
name: test-project-conventions
description: Project conventions
---

# Project Knowledge

### src-old
Old module knowledge
- **Location**: \`modules/src-old.md\`

### src-active
Active module knowledge
- **Location**: \`modules/src-active.md\`
`);
    
    // Create old, low-usage skill (eligible)
    const oldDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const oldSkillPath = join(modulesDir, "src-old.md");
    await writeTextFile(oldSkillPath, `---
name: src-old
description: Old module
usage:
  created_at: ${oldDate}
  last_accessed: ${oldDate}
  access_count: 2
  last_updated: ${oldDate}
---

# Old Module
`);
    
    // Create active skill (not eligible - high access count)
    const activeDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString();
    const activeSkillPath = join(modulesDir, "src-active.md");
    await writeTextFile(activeSkillPath, `---
name: src-active
description: Active module
usage:
  created_at: ${activeDate}
  last_accessed: ${new Date().toISOString()}
  access_count: 20
  last_updated: ${new Date().toISOString()}
---

# Active Module
`);
    
    // Execute command in confirm mode
    const ctx = createMockContext(tmpDir);
    await cleanupCommand.execute({ confirm: true }, ctx);
    
    // Verify main index was updated
    const indexContent = await fileExists(indexPath) ? await require("fs/promises").readFile(indexPath, "utf-8") : "";
    expect(indexContent).not.toContain("src-old");
    expect(indexContent).toContain("src-active"); // Should keep active entry
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("cleanup: uses AND logic for criteria (all conditions must be met)", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const modulesDir = join(tmpDir, ".opencode", "skills", "test-project", "modules");
    await mkdir(modulesDir, { recursive: true });
    
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    
    // Skill 1: Old but high access count (NOT eligible - fails minAccessCount)
    const skill1Path = join(modulesDir, "skill1.md");
    await writeTextFile(skill1Path, `---
name: skill1
description: Old but popular
usage:
  created_at: ${new Date(now - 95 * DAY_MS).toISOString()}
  last_accessed: ${new Date(now - 65 * DAY_MS).toISOString()}
  access_count: 10
  last_updated: ${new Date(now - 65 * DAY_MS).toISOString()}
---
Content
`);
    
    // Skill 2: Young but low access (NOT eligible - fails minAgeDays)
    const skill2Path = join(modulesDir, "skill2.md");
    await writeTextFile(skill2Path, `---
name: skill2
description: Young with low access
usage:
  created_at: ${new Date(now - 30 * DAY_MS).toISOString()}
  last_accessed: ${new Date(now - 65 * DAY_MS).toISOString()}
  access_count: 2
  last_updated: ${new Date(now - 30 * DAY_MS).toISOString()}
---
Content
`);
    
    // Skill 3: Old, low access, but recently active (NOT eligible - fails maxInactiveDays)
    const skill3Path = join(modulesDir, "skill3.md");
    await writeTextFile(skill3Path, `---
name: skill3
description: Old but recently accessed
usage:
  created_at: ${new Date(now - 95 * DAY_MS).toISOString()}
  last_accessed: ${new Date(now - 30 * DAY_MS).toISOString()}
  access_count: 2
  last_updated: ${new Date(now - 30 * DAY_MS).toISOString()}
---
Content
`);
    
    // Skill 4: Meets ALL criteria (ELIGIBLE)
    const skill4Path = join(modulesDir, "skill4.md");
    await writeTextFile(skill4Path, `---
name: skill4
description: Old, inactive, low access
usage:
  created_at: ${new Date(now - 95 * DAY_MS).toISOString()}
  last_accessed: ${new Date(now - 65 * DAY_MS).toISOString()}
  access_count: 2
  last_updated: ${new Date(now - 65 * DAY_MS).toISOString()}
---
Content
`);
    
    // Execute preview mode
    const ctx = createMockContext(tmpDir);
    const result = await cleanupCommand.execute({}, ctx);
    
    // Only skill4 should be eligible (meets all criteria)
    expect(result).toContain("skill4");
    expect(result).not.toContain("skill1");
    expect(result).not.toContain("skill2");
    expect(result).not.toContain("skill3");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("cleanup: handles empty result (no eligible skills)", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const modulesDir = join(tmpDir, ".opencode", "skills", "test-project", "modules");
    await mkdir(modulesDir, { recursive: true });
    
    // Create only active, recent skills (none eligible)
    const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const activeSkillPath = join(modulesDir, "src-active.md");
    await writeTextFile(activeSkillPath, `---
name: src-active
description: Active module
usage:
  created_at: ${recentDate}
  last_accessed: ${new Date().toISOString()}
  access_count: 50
  last_updated: ${new Date().toISOString()}
---

# Active Module
`);
    
    // Execute preview mode
    const ctx = createMockContext(tmpDir);
    const result = await cleanupCommand.execute({}, ctx);
    
    // Should indicate no skills found
    expect(result).toContain("No skills");
    expect(result).not.toContain("Run with --confirm");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("cleanup: respects custom thresholds from config", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const modulesDir = join(tmpDir, ".opencode", "skills", "test-project", "modules");
    await mkdir(modulesDir, { recursive: true });
    
    // Create skill that would be eligible with default thresholds but not with custom
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    
    // Age: 50 days (< default 60, but eligible with custom 30)
    // Access: 3 (< default 5, eligible)
    // Inactive: 50 days (< default 60, but eligible with custom 30)
    const skillPath = join(modulesDir, "skill.md");
    await writeTextFile(skillPath, `---
name: skill
description: Test skill
usage:
  created_at: ${new Date(now - 50 * DAY_MS).toISOString()}
  last_accessed: ${new Date(now - 50 * DAY_MS).toISOString()}
  access_count: 3
  last_updated: ${new Date(now - 50 * DAY_MS).toISOString()}
---
Content
`);
    
    // Execute with custom thresholds (more aggressive cleanup)
    const baseCtx = createMockContext(tmpDir);
    const ctx = {
      ...baseCtx,
      // Simulate custom config injection
      cleanupThresholds: {
        minAgeDays: 30,
        minAccessCount: 5,
        maxInactiveDays: 30,
      }
    };
    const result = await cleanupCommand.execute({}, ctx as any);
    
    // Should be eligible with these stricter thresholds
    expect(result).toContain("skill");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("cleanup: handles missing usage metadata gracefully", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
  
  try {
    // Create project structure
    const modulesDir = join(tmpDir, ".opencode", "skills", "test-project", "modules");
    await mkdir(modulesDir, { recursive: true });
    
    // Create skill without usage metadata (legacy format)
    const skillPath = join(modulesDir, "legacy.md");
    await writeTextFile(skillPath, `---
name: legacy
description: Legacy skill without usage metadata
---

# Legacy Module
Content here
`);
    
    // Execute preview mode
    const ctx = createMockContext(tmpDir);
    const result = await cleanupCommand.execute({}, ctx);
    
    // Should not crash, just skip skills without usage metadata
    expect(result).toBeDefined();
    expect(result).not.toContain("legacy");
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
