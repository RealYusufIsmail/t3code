import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { act, StrictMode, type ReactNode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ScopedSettingsPatch } from "./scopedSettings";
import { WorktreesDirectoryRow } from "./StorageSettings";

const state = vi.hoisted(() => ({
  settings: { worktreesDirectory: "" } as unknown as typeof DEFAULT_UNIFIED_SETTINGS,
  mixed: false,
  updateSettings: vi.fn<(patch: ScopedSettingsPatch) => void>(),
  pickFolder: vi.fn<() => Promise<string | null>>(),
}));

vi.mock("./useScopedSettings", () => ({
  useScopedSettings: () => state.settings,
  useScopedSettingsMixed: () => state.mixed,
  useUpdateScopedSettings: () => state.updateSettings,
  useClearScopedSettings: () => vi.fn(),
}));

vi.mock("./SettingsScopeContext", () => ({
  useSettingsScope: () => ({
    scope: { kind: "all", environmentIds: [] },
    environment: null,
    connectedEnvironments: [
      {
        serverConfig: {
          environment: {
            capabilities: {
              worktreesDirectory: true,
            },
          },
        },
      },
    ],
    targets: [{ environmentId: "env-1", settings: state.settings }],
  }),
}));

vi.mock("../../localApi", () => ({
  ensureLocalApi: () => ({
    dialogs: {
      pickFolder: state.pickFolder,
    },
  }),
}));

vi.mock("./settingsSearch", () => ({
  searchableSetting: (id: string) => ({ id, title: "Worktree Storage Directory" }),
}));

vi.mock("./settingsLayout", () => ({
  SettingResetButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button data-testid="reset-button" onClick={onClick}>
      {`Reset ${label}`}
    </button>
  ),
  SettingsSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SettingsRow: ({
    title,
    description,
    control,
    resetAction,
  }: {
    title: ReactNode;
    description?: ReactNode;
    control?: ReactNode;
    resetAction?: ReactNode;
  }) => (
    <div data-testid="settings-row">
      <span data-testid="row-title">{title}</span>
      {description ? <span data-testid="row-desc">{description}</span> : null}
      {control}
      {resetAction}
    </div>
  ),
  SettingsPageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./SettingsScopeNotice", () => ({
  SettingsScopeNotice: () => null,
}));

describe("StorageSettings Worktree Storage Directory", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    state.settings = { ...DEFAULT_UNIFIED_SETTINGS, worktreesDirectory: "" };
    state.mixed = false;
    state.updateSettings.mockClear();
    state.pickFolder.mockReset();
  });

  it("renders Worktree Storage Directory with placeholder and description", () => {
    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    const input = root.findByProps({ "aria-label": "Worktree Storage Directory" });
    expect(input.props.placeholder).toBe("~/.t3/worktrees (default)");
    expect(input.props.defaultValue).toBe("");

    const desc = root.findAllByProps({ "data-testid": "row-desc" });
    const hasWorktreeDesc = desc.some((d) =>
      d.children.includes(
        "Directory where git worktrees for threads are created. Point this to an external drive to save internal disk space.",
      ),
    );
    expect(hasWorktreeDesc).toBe(true);
  });

  it("updates worktree directory on blur", () => {
    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    const input = root.findByProps({ "aria-label": "Worktree Storage Directory" });

    act(() => {
      input.props.onChange();
      input.props.onBlur({ target: { value: "/Volumes/MySSD/t3-worktrees" } });
    });

    expect(state.updateSettings).toHaveBeenCalledWith({
      worktreesDirectory: "/Volumes/MySSD/t3-worktrees",
    });
  });

  it("allows picking folder via folder picker button", async () => {
    state.pickFolder.mockResolvedValue("/Volumes/External/worktrees");

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    const browseButton = root.findByProps({ "aria-label": "Choose worktree directory" });

    await act(async () => {
      await browseButton.props.onClick();
    });

    expect(state.pickFolder).toHaveBeenCalled();
    expect(state.updateSettings).toHaveBeenCalledWith({
      worktreesDirectory: "/Volumes/External/worktrees",
    });
  });

  it("renders reset button when custom directory is configured and resets to empty string", () => {
    state.settings = {
      ...DEFAULT_UNIFIED_SETTINGS,
      worktreesDirectory: "/Volumes/MySSD/t3-worktrees",
    };

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    const root = renderer!.root;
    const resetButton = root.findByProps({ "data-testid": "reset-button" });
    expect(resetButton).toBeDefined();

    act(() => {
      resetButton.props.onClick();
    });

    expect(state.updateSettings).toHaveBeenCalledWith({
      worktreesDirectory: "",
    });
  });
});
