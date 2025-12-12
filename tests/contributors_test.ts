//----------------------------------------------------------------------------------------------------
// Copyright (c) 2025                    orgrinrt                    orgrinrt@ikiuni.dev
// SPDX-License-Identifier: MPL-2.0      https://mozilla.org/MPL/2.0 contact@hiisi.digital
//----------------------------------------------------------------------------------------------------

import { formatContributor, mergeContributors } from "#core";
import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";

describe("mergeContributors", () => {
  it("should return empty array when both inputs are empty", () => {
    const result = mergeContributors([], []);
    assertEquals(result, []);
  });

  it("should return existing contributors when new is empty", () => {
    const existing = [{ name: "Alice", email: "alice@example.com" }];
    const result = mergeContributors(existing, []);
    assertEquals(result, existing);
  });

  it("should return new contributors when existing is empty", () => {
    const newContributors = [{ name: "Bob", email: "bob@example.com" }];
    const result = mergeContributors([], newContributors);
    assertEquals(result, newContributors);
  });

  it("should merge without duplicates", () => {
    const existing = [{ name: "Alice", email: "alice@example.com" }];
    const newContributors = [
      { name: "Bob", email: "bob@example.com" },
      { name: "Alice Duplicate", email: "alice@example.com" },
    ];
    const result = mergeContributors(existing, newContributors);

    assertEquals(result.length, 2);
    assertEquals(result[0].name, "Alice");
    assertEquals(result[1].name, "Bob");
  });

  it("should be case-insensitive for email deduplication", () => {
    const existing = [{ name: "Alice", email: "Alice@Example.COM" }];
    const newContributors = [{ name: "alice lower", email: "alice@example.com" }];
    const result = mergeContributors(existing, newContributors);

    assertEquals(result.length, 1);
    assertEquals(result[0].name, "Alice");
  });

  it("should preserve order - existing first, then new", () => {
    const existing = [
      { name: "First", email: "first@example.com" },
      { name: "Second", email: "second@example.com" },
    ];
    const newContributors = [
      { name: "Third", email: "third@example.com" },
      { name: "Fourth", email: "fourth@example.com" },
    ];
    const result = mergeContributors(existing, newContributors);

    assertEquals(result.length, 4);
    assertEquals(result[0].name, "First");
    assertEquals(result[1].name, "Second");
    assertEquals(result[2].name, "Third");
    assertEquals(result[3].name, "Fourth");
  });

  it("should handle multiple duplicates", () => {
    const existing = [
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: "bob@example.com" },
    ];
    const newContributors = [
      { name: "Alice 2", email: "alice@example.com" },
      { name: "Charlie", email: "charlie@example.com" },
      { name: "Bob 2", email: "bob@example.com" },
    ];
    const result = mergeContributors(existing, newContributors);

    assertEquals(result.length, 3);
    assertEquals(result.map((c) => c.name), ["Alice", "Bob", "Charlie"]);
  });
});

describe("formatContributor", () => {
  it("should format contributor in name <email> format", () => {
    const contributor = { name: "Test User", email: "test@example.com" };
    const result = formatContributor(contributor);
    assertEquals(result, "Test User <test@example.com>");
  });

  it("should handle single-word names", () => {
    const contributor = { name: "Alice", email: "alice@example.com" };
    const result = formatContributor(contributor);
    assertEquals(result, "Alice <alice@example.com>");
  });

  it("should handle names with special characters", () => {
    const contributor = { name: "O'Brien", email: "obrien@example.com" };
    const result = formatContributor(contributor);
    assertEquals(result, "O'Brien <obrien@example.com>");
  });

  it("should handle names with multiple parts", () => {
    const contributor = {
      name: "Jean-Pierre de la Fontaine",
      email: "jp@example.com",
    };
    const result = formatContributor(contributor);
    assertEquals(result, "Jean-Pierre de la Fontaine <jp@example.com>");
  });
});
