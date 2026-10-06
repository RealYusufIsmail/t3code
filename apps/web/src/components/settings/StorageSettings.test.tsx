import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";
import { act, StrictMode, type ReactNode } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ScopedSettingsPatch } from "./scopedSettings";
import { WorktreesDirectoryRow } from "./StorageSettings";

const state = vi.hoisted(() => ({
  settings: { worktreesDirectory: "" } as unknown as typeof DEFAULT_UNIFIED_SETTINGS,
  mixed: false,
  connectedEnvironments: [] as Array<Record<string, unknown>>,
  targets: [] as Array<Record<string, unknown>>,
  primaryEnvironmentId: "env-primary",
  desktopLocalBootstraps: [] as Array<Record<string, unknown>>,
  updateSettings: vi.fn<(patch: ScopedSettingsPatch) => void>(),
  pickFolder: vi.fn<(options?: Record<string, unknown>) => Promise<string | null>>(),
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
    connectedEnvironments: state.connectedEnvironments,
    targets: state.targets,
  }),
}));

vi.mock("../../connection/useDesktopLocalBootstraps", () => ({
  useDesktopLocalBootstraps: () => state.desktopLocalBootstraps,
}));

vi.mock("../../state/environments", () => ({
  usePrimaryEnvironmentId: () => state.primaryEnvironmentId,
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

function setDesktopBridge(bridge: unknown) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { desktopBridge: bridge },
  });
}

describe("StorageSettings Worktree Storage Directory", () => {
  let renderer: ReactTestRenderer | null = null;

  beforeEach(() => {
    state.settings = { ...DEFAULT_UNIFIED_SETTINGS, worktreesDirectory: "" };
    state.mixed = false;
    state.primaryEnvironmentId = "env-primary";
    state.connectedEnvironments = [
      {
        environmentId: "env-wsl",
        displayUrl: "http://wsl.local",
        entry: {
          target: {
            _tag: "BearerConnectionTarget",
            connectionId: "local:wsl:Ubuntu",
          },
        },
        serverConfig: {
          environment: {
            capabilities: { worktreesDirectory: true },
            platform: { os: "linux" },
          },
        },
      },
    ];
    state.targets = [{ environmentId: "env-wsl", settings: state.settings }];
    state.desktopLocalBootstraps = [{ id: "wsl:Ubuntu", httpBaseUrl: "http://wsl.local" }];
    state.updateSettings.mockClear();
    state.pickFolder.mockReset();
    setDesktopBridge({
      getLocalEnvironmentBootstraps: () => [
        { id: "primary", httpBaseUrl: "http://primary.local" },
        { id: "wsl:Ubuntu", httpBaseUrl: "http://wsl.local" },
      ],
      getWslState: async () => ({
        enabled: false,
        distro: null,
        available: true,
        wslOnly: false,
        distros: [],
        preflightError: null,
      }),
    });
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

    expect(state.pickFolder).toHaveBeenCalledWith({
      initialPath: null,
      targetEnvironmentId: "wsl:Ubuntu",
    });
    expect(state.updateSettings).toHaveBeenCalledWith({
      worktreesDirectory: "/Volumes/External/worktrees",
    });
  });

  it("hides folder browsing when no desktop picker is available", () => {
    setDesktopBridge(undefined);

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    expect(
      renderer!.root.findAllByProps({ "aria-label": "Choose worktree directory" }),
    ).toHaveLength(0);
    expect(
      renderer!.root.findByProps({ "aria-label": "Worktree Storage Directory" }),
    ).toBeDefined();
  });

  it("hides folder browsing for a scope spanning multiple environments", () => {
    state.connectedEnvironments = [
      ...state.connectedEnvironments,
      {
        environmentId: "env-other",
        displayUrl: "http://other.local",
        entry: { target: { _tag: "BearerConnectionTarget", connectionId: "remote:other" } },
        serverConfig: {
          environment: {
            capabilities: { worktreesDirectory: true },
            platform: { os: "linux" },
          },
        },
      },
    ];
    state.targets = [...state.targets, { environmentId: "env-other", settings: state.settings }];

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    expect(
      renderer!.root.findAllByProps({ "aria-label": "Choose worktree directory" }),
    ).toHaveLength(0);
  });

  it("keeps primary desktop browsing on the primary filesystem", async () => {
    state.primaryEnvironmentId = "env-primary";
    state.connectedEnvironments = [
      {
        environmentId: "env-primary",
        displayUrl: "http://primary.local",
        entry: { target: { _tag: "PrimaryConnectionTarget" } },
        serverConfig: {
          environment: {
            capabilities: { worktreesDirectory: true },
            platform: { os: "darwin" },
          },
        },
      },
    ];
    state.targets = [{ environmentId: "env-primary", settings: state.settings }];
    state.desktopLocalBootstraps = [];

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    await act(async () => {
      await renderer!.root
        .findByProps({ "aria-label": "Choose worktree directory" })
        .props.onClick();
    });

    expect(state.pickFolder).toHaveBeenCalledWith({ initialPath: null });
  });

  it("routes a WSL-only primary picker to its WSL backend", async () => {
    state.primaryEnvironmentId = "env-primary";
    state.connectedEnvironments = [
      {
        environmentId: "env-primary",
        displayUrl: "http://primary.local",
        entry: { target: { _tag: "PrimaryConnectionTarget" } },
        serverConfig: {
          environment: {
            capabilities: { worktreesDirectory: true },
            platform: { os: "linux" },
          },
        },
      },
    ];
    state.targets = [{ environmentId: "env-primary", settings: state.settings }];
    state.desktopLocalBootstraps = [];
    setDesktopBridge({
      getLocalEnvironmentBootstraps: () => [{ id: "primary", httpBaseUrl: "http://primary.local" }],
      getWslState: async () => ({
        enabled: true,
        distro: "Ubuntu",
        available: true,
        wslOnly: true,
        distros: [{ name: "Ubuntu", isDefault: true }],
        preflightError: null,
      }),
    });

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    await act(async () => {
      await renderer!.root
        .findByProps({ "aria-label": "Choose worktree directory" })
        .props.onClick();
    });

    expect(state.pickFolder).toHaveBeenCalledWith({
      initialPath: null,
      targetEnvironmentId: "wsl:Ubuntu",
    });
  });

  it("does not open the picker when WSL state lookup fails", async () => {
    state.primaryEnvironmentId = "env-primary";
    state.connectedEnvironments = [
      {
        environmentId: "env-primary",
        displayUrl: "http://primary.local",
        entry: { target: { _tag: "PrimaryConnectionTarget" } },
        serverConfig: {
          environment: {
            capabilities: { worktreesDirectory: true },
            platform: { os: "linux" },
          },
        },
      },
    ];
    state.targets = [{ environmentId: "env-primary", settings: state.settings }];
    state.desktopLocalBootstraps = [];
    setDesktopBridge({
      getLocalEnvironmentBootstraps: () => [{ id: "primary", httpBaseUrl: "http://primary.local" }],
      getWslState: async () => {
        throw new Error("WSL state unavailable");
      },
    });

    act(() => {
      renderer = create(
        <StrictMode>
          <WorktreesDirectoryRow />
        </StrictMode>,
      );
    });

    await act(async () => {
      await renderer!.root
        .findByProps({ "aria-label": "Choose worktree directory" })
        .props.onClick();
    });

    expect(state.pickFolder).not.toHaveBeenCalled();
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
