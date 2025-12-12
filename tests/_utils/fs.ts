//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
//                                      orgrinrt                 ort@hiisi.digital
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Cross-runtime file system utilities for testing.
 *
 * This module provides a unified API for file system operations that works
 * across Deno, Node.js, and Bun. It abstracts away runtime-specific APIs
 * so that tests can run on any JavaScript runtime.
 *
 * Usage:
 *   import { createTempDir, writeFile, readFile, removeDir } from "./_utils/fs.ts";
 *
 * The module auto-detects the runtime and uses the appropriate APIs:
 * - Deno: Uses Deno.* APIs directly
 * - Node.js/Bun: Uses node:fs/promises and node:os
 */

// Runtime detection - using typeof checks to avoid reference errors
// deno-lint-ignore no-explicit-any
const globalDeno = (globalThis as any).Deno;
// deno-lint-ignore no-explicit-any
const globalProcess = (globalThis as any).process;

const isDeno = typeof globalDeno !== "undefined";
const isNode = typeof globalProcess !== "undefined" &&
  globalProcess.versions?.node !== undefined;
const isBun = typeof globalProcess !== "undefined" &&
  globalProcess.versions?.bun !== undefined;

// Type definitions for Node.js modules (for TypeScript compatibility)
interface NodeFsPromises {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
  readFile(path: string, encoding: string): Promise<string>;
  rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void>;
  access(path: string): Promise<void>;
}

interface NodePath {
  join(...paths: string[]): string;
  dirname(path: string): string;
}

interface NodeOs {
  tmpdir(): string;
}

interface NodeCrypto {
  randomBytes(size: number): { toString(encoding: string): string };
}

// Dynamic imports for Node.js/Bun (will be tree-shaken in Deno)
let nodeFs: NodeFsPromises | null = null;
let nodePath: NodePath | null = null;
let nodeOs: NodeOs | null = null;
let nodeCrypto: NodeCrypto | null = null;

/**
 * Initialize Node.js modules if running in Node/Bun environment.
 * This is called lazily on first use.
 */
async function initNodeModules(): Promise<void> {
  if (!isDeno && !nodeFs) {
    // Dynamic imports for Node.js/Bun
    const fsModule = await import("node:fs/promises");
    const pathModule = await import("node:path");
    const osModule = await import("node:os");
    const cryptoModule = await import("node:crypto");

    nodeFs = fsModule as unknown as NodeFsPromises;
    nodePath = pathModule as unknown as NodePath;
    nodeOs = osModule as unknown as NodeOs;
    nodeCrypto = cryptoModule as unknown as NodeCrypto;
  }
}

/**
 * Creates a temporary directory with an optional prefix.
 *
 * @param prefix - Optional prefix for the temp directory name
 * @returns The path to the created temporary directory
 */
export async function createTempDir(prefix = "test_"): Promise<string> {
  if (isDeno) {
    return await globalDeno.makeTempDir({ prefix });
  }

  await initNodeModules();

  const tempBase = nodeOs!.tmpdir();
  const randomSuffix = nodeCrypto!.randomBytes(8).toString("hex");
  const dirName = `${prefix}${randomSuffix}`;
  const dirPath = nodePath!.join(tempBase, dirName);

  await nodeFs!.mkdir(dirPath, { recursive: true });
  return dirPath;
}

/**
 * Writes text content to a file, creating parent directories if needed.
 *
 * @param path - The file path to write to
 * @param content - The text content to write
 */
export async function writeFile(path: string, content: string): Promise<void> {
  if (isDeno) {
    await globalDeno.writeTextFile(path, content);
    return;
  }

  await initNodeModules();

  // Ensure parent directory exists
  const dir = nodePath!.dirname(path);
  await nodeFs!.mkdir(dir, { recursive: true });
  await nodeFs!.writeFile(path, content, "utf-8");
}

/**
 * Reads text content from a file.
 *
 * @param path - The file path to read from
 * @returns The text content of the file
 */
export async function readFile(path: string): Promise<string> {
  if (isDeno) {
    return await globalDeno.readTextFile(path);
  }

  await initNodeModules();
  return await nodeFs!.readFile(path, "utf-8");
}

/**
 * Removes a file or directory recursively.
 *
 * @param path - The path to remove
 */
export async function removeDir(path: string): Promise<void> {
  try {
    if (isDeno) {
      await globalDeno.remove(path, { recursive: true });
      return;
    }

    await initNodeModules();
    await nodeFs!.rm(path, { recursive: true, force: true });
  } catch {
    // Ignore errors during cleanup (e.g., path doesn't exist)
  }
}

/**
 * Checks if a file or directory exists.
 *
 * @param path - The path to check
 * @returns True if the path exists, false otherwise
 */
export async function exists(path: string): Promise<boolean> {
  try {
    if (isDeno) {
      await globalDeno.stat(path);
      return true;
    }

    await initNodeModules();
    await nodeFs!.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a directory and all parent directories.
 *
 * @param path - The directory path to create
 */
export async function mkdir(path: string): Promise<void> {
  if (isDeno) {
    await globalDeno.mkdir(path, { recursive: true });
    return;
  }

  await initNodeModules();
  await nodeFs!.mkdir(path, { recursive: true });
}

/**
 * Gets the current working directory.
 *
 * @returns The current working directory path
 */
export function cwd(): string {
  if (isDeno) {
    return globalDeno.cwd();
  }
  return globalProcess.cwd();
}

/**
 * Joins path segments using the appropriate path separator.
 *
 * @param segments - Path segments to join
 * @returns The joined path
 */
export function joinPath(...segments: string[]): string {
  // Simple cross-platform path join
  // Works for most cases in tests
  return segments.join("/").replace(/\/+/g, "/");
}

/**
 * Runtime information for debugging.
 */
export const runtime = {
  isDeno,
  isNode,
  isBun,
  name: isDeno ? "deno" : isBun ? "bun" : isNode ? "node" : "unknown",
} as const;
