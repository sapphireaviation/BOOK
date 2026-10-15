#!/usr/bin/env node
// Fails when an em dash or en dash appears in user-facing source.
// Code comments are allowed to be terse but must follow the same rule, so we check everything in src/ and docs/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const roots = ["src", "docs", "public"];
const exts = new Set([".ts", ".tsx", ".md", ".mdx", ".txt", ".json", ".css"]);
const bad = /[–—]/;
const problems = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (exts.has(extname(p))) {
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (bad.test(line)) problems.push(`${p}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
  }
}

roots.forEach(walk);
if (problems.length) {
  console.error(`Found ${problems.length} em or en dash(es). Use a comma, period, colon or parentheses instead:\n`);
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Copy check passed: no em or en dashes.");
