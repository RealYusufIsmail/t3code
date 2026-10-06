import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as NodeOS from "node:os";

import { managedWorktreesDirectories, resolveWorktreesDirectory } from "./worktreesDirectory.ts";

describe("worktreesDirectory", () => {
  it.effect("resolves default directory when setting is empty or whitespace", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");

      assert.equal(resolveWorktreesDirectory("", defaultDir, path), defaultDir);
      assert.equal(resolveWorktreesDirectory("   ", defaultDir, path), defaultDir);
      assert.equal(resolveWorktreesDirectory("\t\n", defaultDir, path), defaultDir);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("resolves tilde to user home directory", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");
      const home = NodeOS.homedir();

      const result = resolveWorktreesDirectory("~/custom-worktrees", defaultDir, path);
      assert.equal(result, path.resolve(home, "custom-worktrees"));

      const resultWithTrailing = resolveWorktreesDirectory("~/custom-worktrees/", defaultDir, path);
      assert.equal(resultWithTrailing, path.resolve(home, "custom-worktrees"));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("resolves valid absolute custom path and normalizes trailing slashes", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");

      const result = resolveWorktreesDirectory("/Volumes/External/worktrees/", defaultDir, path);
      assert.equal(result, path.resolve("/Volumes/External/worktrees"));

      const resultWithSpaces = resolveWorktreesDirectory(
        "  /Volumes/External/worktrees  ",
        defaultDir,
        path,
      );
      assert.equal(resultWithSpaces, path.resolve("/Volumes/External/worktrees"));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("rejects relative paths", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");

      assert.isNull(resolveWorktreesDirectory("relative/path", defaultDir, path));
      assert.isNull(resolveWorktreesDirectory("./relative/path", defaultDir, path));
      assert.isNull(resolveWorktreesDirectory("../relative/path", defaultDir, path));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("rejects filesystem root paths", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");

      assert.isNull(resolveWorktreesDirectory("/", defaultDir, path));
      assert.isNull(resolveWorktreesDirectory("///", defaultDir, path));
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("manages worktrees directories including current and previous directories", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");

      const dirs = managedWorktreesDirectories(
        {
          worktreesDirectory: "/Volumes/External/worktrees",
          previousWorktreesDirectories: ["/Volumes/OldDisk/worktrees", "/Users/test/.t3/worktrees"],
        },
        defaultDir,
        path,
      );

      assert.deepEqual(dirs, [
        defaultDir,
        path.resolve("/Volumes/External/worktrees"),
        path.resolve("/Volumes/OldDisk/worktrees"),
      ]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("filters invalid paths from managed worktrees directories", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const defaultDir = path.resolve("/Users/test/.t3/worktrees");

      const dirs = managedWorktreesDirectories(
        {
          worktreesDirectory: "/", // root -> invalid
          previousWorktreesDirectories: ["relative-path", "/Volumes/Valid/worktrees"],
        },
        defaultDir,
        path,
      );

      assert.deepEqual(dirs, [defaultDir, path.resolve("/Volumes/Valid/worktrees")]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
