/**
 * Knowledge storage module - JSONL append writer with file locking
 * Handles persistent storage of facts in directory-local .knowledge/ folders
 */

import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import type { Fact } from '../types';
import { fileExists, readTextFile, writeTextFile, sleep, removeFile } from '../utils/fs-compat';

/**
 * Appends a fact to the JSONL knowledge file for a given directory
 * 
 * Storage structure:
 * - src/order/service.ts → src/order/.knowledge/facts.jsonl
 * - src/user/hooks/useAuth.ts → src/user/.knowledge/facts.jsonl
 * 
 * @param directory - Target directory path (e.g., "src/order")
 * @param fact - Fact object to append
 * @throws Error if file operations fail
 */
export async function appendFact(directory: string, fact: Fact): Promise<void> {
  const knowledgeDir = join(directory, '.knowledge');
  const factsFile = join(knowledgeDir, 'facts.jsonl');
  const lockFile = join(knowledgeDir, '.lock');

  // Ensure .knowledge directory exists
  await mkdir(knowledgeDir, { recursive: true });

  // Acquire file lock with timeout
  const lock = await acquireLock(lockFile, 5000);
  
  try {
    // Append fact as single-line JSON
    const line = JSON.stringify(fact) + '\n';
    const existingContent = await fileExists(factsFile) ? await readTextFile(factsFile) : '';
    await writeTextFile(factsFile, existingContent + line);
  } finally {
    // Always release lock
    await releaseLock(lock);
  }
}

/**
 * Acquires an exclusive file lock using a lock file
 * 
 * @param lockFile - Path to lock file
 * @param timeoutMs - Maximum wait time in milliseconds
 * @returns Lock handle for cleanup
 * @throws Error if lock cannot be acquired within timeout
 */
async function acquireLock(lockFile: string, timeoutMs: number): Promise<{ file: string; pid: string }> {
  const startTime = Date.now();
  
  while (true) {
    try {
      // Try to create lock file exclusively (fails if exists)
      if (await fileExists(lockFile)) {
        throw { code: 'EEXIST' };
      }
      const pid = process.pid.toString();
      await writeTextFile(lockFile, pid);
      return { file: lockFile, pid };
    } catch (error: any) {
      // Lock file exists - check if stale
      if (error.code === 'EEXIST') {
        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          throw new Error(`Failed to acquire lock on ${lockFile} within ${timeoutMs}ms`);
        }
        
        // Wait and retry
        await sleep(50);
        continue;
      }
      
      // Other error - propagate
      throw error;
    }
  }
}

/**
 * Releases a file lock by closing and deleting the lock file
 * 
 * @param lock - Lock handle from acquireLock
 */
async function releaseLock(lock: { file: string; pid: string }): Promise<void> {
  try {
    if (await fileExists(lock.file)) {
      await removeFile(lock.file);
    }
  } catch (error) {
    // Best effort - log but don't throw
    console.error(`Failed to release lock ${lock.file}:`, error);
  }
}

/**
 * Determines the knowledge directory for a given file path
 * 
 * @param filePath - Source file path (e.g., "src/order/service.ts")
 * @returns Directory path for knowledge storage (e.g., "src/order")
 */
export function getKnowledgeDirectory(filePath: string): string {
  return dirname(filePath);
}
