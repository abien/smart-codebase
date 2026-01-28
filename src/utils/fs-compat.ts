/**
 * Node.js compatible file system utilities
 * Provides Bun-like API using Node.js fs/promises and fast-glob
 */

import { access, readFile, writeFile, unlink } from 'fs/promises';
import fg from 'fast-glob';

/**
 * Check if a file exists
 * @param path - File path to check
 * @returns true if file exists, false otherwise
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read text file content
 * @param path - File path to read
 * @returns File content as string
 */
export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf-8');
}

/**
 * Write text content to file
 * @param path - File path to write
 * @param content - Content to write
 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8');
}

/**
 * Sleep for specified milliseconds
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Remove a file (ignores if file doesn't exist)
 * @param path - File path to remove
 */
export async function removeFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Ignore if file doesn't exist
  }
}

/**
 * Find files matching a glob pattern
 * @param pattern - Glob pattern (e.g., '**\/*.ts')
 * @param options - Search options
 * @returns Array of matching file paths
 */
export async function findFiles(
  pattern: string,
  options: { cwd: string; absolute?: boolean }
): Promise<string[]> {
  return fg(pattern, {
    cwd: options.cwd,
    absolute: options.absolute ?? false,
    onlyFiles: true,
  });
}
