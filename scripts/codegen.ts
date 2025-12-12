//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

/**
 * Generates TypeScript types from the JSON schema.
 *
 * This script reads schema/config.schema.json and outputs core/config.generated.ts
 * with fully typed interfaces derived from the schema.
 *
 * Run with: deno task codegen
 */

const SCHEMA_PATH = new URL("../schema/config.schema.json", import.meta.url);
const OUTPUT_PATH = new URL("../core/config.generated.ts", import.meta.url);

interface JsonSchemaProperty {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  examples?: unknown[];
}

interface JsonSchema extends JsonSchemaProperty {
  $schema?: string;
  $id?: string;
  title?: string;
}

function schemaTypeToTs(prop: JsonSchemaProperty, propName: string): string {
  if (prop.enum) {
    return prop.enum.map((v) => `"${v}"`).join(" | ");
  }

  const schemaType = prop.type;

  if (Array.isArray(schemaType)) {
    return schemaType.map((t) => jsonTypeToTs(t, prop, propName)).join(" | ");
  }

  return jsonTypeToTs(schemaType ?? "string", prop, propName);
}

function jsonTypeToTs(type: string, prop: JsonSchemaProperty, propName: string): string {
  switch (type) {
    case "string":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array":
      if (prop.items) {
        if (prop.items.type === "object" && prop.items.properties) {
          return "Contributor[]";
        }
        const itemType = schemaTypeToTs(prop.items, propName);
        return `${itemType}[]`;
      }
      return "unknown[]";
    case "object":
      return "Record<string, unknown>";
    default:
      return "unknown";
  }
}

function truncateDescription(str: string, maxLength = 60): string {
  const cleaned = str.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength - 3) + "...";
}

function formatDefault(value: unknown): string {
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    // Escape */ sequences that would break JSDoc comments
    const escaped = value.replace(/\*\//g, "* /");
    return `"${escaped}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map((v) => formatDefault(v)).join(", ")}]`;
  }
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  console.log("Reading schema...");
  const schemaText = await Deno.readTextFile(SCHEMA_PATH);
  const schema: JsonSchema = JSON.parse(schemaText);

  if (!schema.properties) {
    throw new Error("Schema has no properties");
  }

  console.log("Generating TypeScript...");

  const lines: string[] = [];

  // Header
  lines.push(
    "//----------------------------------------------------------------------------------------------------",
  );
  lines.push(
    "// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev",
  );
  lines.push(
    "// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital",
  );
  lines.push(
    "//----------------------------------------------------------------------------------------------------",
  );
  lines.push("");
  lines.push("/** AUTO-GENERATED FILE - DO NOT EDIT. Run `deno task codegen` to regenerate. */");
  lines.push("");

  // Contributor type
  lines.push("/** Represents a contributor in a copyright header. */");
  lines.push("export interface Contributor {");
  lines.push("  /** The contributor's display name. */");
  lines.push("  name: string;");
  lines.push("  /** The contributor's email address. */");
  lines.push("  email: string;");
  lines.push("}");
  lines.push("");

  // ContributorSelection type
  lines.push("/** Strategy for selecting which contributors to display. */");
  lines.push('export type ContributorSelection = "commits" | "lines" | "recent" | "manual";');
  lines.push("");

  // Main config interface
  lines.push("/** Configuration for ante copyright header management. */");
  lines.push("export interface AnteConfig {");

  for (const [propName, prop] of Object.entries(schema.properties)) {
    let comment = "";
    if (prop.description) {
      comment = truncateDescription(prop.description);
    }
    // Skip defaults for arrays to avoid */" patterns breaking JSDoc
    if (prop.default !== undefined && prop.type !== "array") {
      const defaultStr = formatDefault(prop.default);
      if (comment) {
        comment += ` @default ${defaultStr}`;
      } else {
        comment = `@default ${defaultStr}`;
      }
    }

    let tsType: string;
    if (propName === "contributorSelection") {
      tsType = "ContributorSelection";
    } else if (propName === "manualContributors") {
      tsType = "Contributor[]";
    } else {
      tsType = schemaTypeToTs(prop, propName);
    }

    if (comment) {
      lines.push(`  /** ${comment} */`);
    }
    lines.push(`  ${propName}?: ${tsType};`);
  }

  lines.push("}");
  lines.push("");

  // Defaults object
  lines.push("/** Default values for all configuration options. */");
  lines.push("export const DEFAULT_CONFIG: Required<AnteConfig> = {");

  for (const [propName, prop] of Object.entries(schema.properties)) {
    const defaultValue = prop.default;
    if (defaultValue !== undefined) {
      lines.push(`  ${propName}: ${formatDefault(defaultValue)},`);
    } else {
      if (prop.type === "string") {
        lines.push(`  ${propName}: "",`);
      } else if (prop.type === "array") {
        lines.push(`  ${propName}: [],`);
      } else if (prop.type === "integer" || prop.type === "number") {
        lines.push(`  ${propName}: 0,`);
      } else {
        lines.push(`  ${propName}: undefined as never,`);
      }
    }
  }

  lines.push("};");
  lines.push("");

  // ResolvedConfig type
  lines.push("/** Fully resolved configuration with all values populated. */");
  lines.push("export type ResolvedConfig = Required<AnteConfig>;");
  lines.push("");

  const output = lines.join("\n");
  await Deno.writeTextFile(OUTPUT_PATH, output);

  console.log(`Generated ${OUTPUT_PATH}`);
}

if (import.meta.main) {
  await main();
}
