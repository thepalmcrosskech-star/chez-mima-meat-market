import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";

const ROOT = process.cwd();
const SCANNED_DIRS = ["src/pages", "src/components"];
// shadcn primitives are never rendered as navigation here, and NavLink.tsx is
// an unused compatibility shim that no screen imports.
const IGNORED = [/^src\/components\/ui\//, /^src\/components\/NavLink\.tsx$/];

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) out.push(full);
  }
  return out;
};

const files = SCANNED_DIRS.flatMap((dir) => walk(join(ROOT, dir)))
  .map((file) => posix.join(...file.slice(ROOT.length + 1).split("/")))
  .filter((file) => !IGNORED.some((pattern) => pattern.test(file)));

describe("no hover link preview", () => {
  it("scans the screens that are actually rendered", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("keeps every clickable element free of an href, so the browser shows no URL bar on hover", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(join(ROOT, file), "utf8");
      return /<a[\s>]/.test(source) || /\shref=/.test(source);
    });
    expect(offenders).toEqual([]);
  });
});
