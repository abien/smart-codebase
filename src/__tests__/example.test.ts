import { test, expect } from "bun:test";

test("example test - basic arithmetic", () => {
  expect(1 + 1).toBe(2);
});

test("example test - string operations", () => {
  const greeting = "Hello, World!";
  expect(greeting).toContain("World");
});

test("example test - array operations", () => {
  const numbers = [1, 2, 3, 4, 5];
  expect(numbers).toHaveLength(5);
  expect(numbers[0]).toBe(1);
});
