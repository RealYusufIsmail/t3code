import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";

import { preferences } from "./handlers.ts";

describe("environment handlers", () => {
  it("includes worktreesDirectory in environment preferences", () => {
    const prefs = preferences(DEFAULT_SERVER_SETTINGS);
    assert.equal(prefs.worktreesDirectory, "");

    const customPrefs = preferences({
      ...DEFAULT_SERVER_SETTINGS,
      worktreesDirectory: "/Volumes/MySSD/t3-worktrees",
    });
    assert.equal(customPrefs.worktreesDirectory, "/Volumes/MySSD/t3-worktrees");
  });
});
