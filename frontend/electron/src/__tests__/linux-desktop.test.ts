import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEVELOPMENT_DESKTOP_NAME,
  appImageRelaunchOptions,
  registerAppImageCommand,
  registerDevelopmentDesktop,
} from "../linux-desktop";

const directories: string[] = [];
afterEach(() =>
  directories
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true })),
);

describe("Linux development desktop identity", () => {
  it("registers a matching identity and absolute icon with safely quoted checkout paths", () => {
    const dataHome = mkdtempSync(join(tmpdir(), "vectora-desktop-"));
    directories.push(dataHome);
    const options = {
      dataHome,
      executable: "/tools/Electron App/electron",
      main: "/repo 100%/main.js",
      icon: "/repo/icon.png",
    };
    registerDevelopmentDesktop(options);
    registerDevelopmentDesktop(options);
    const entry = readFileSync(
      join(dataHome, "applications", DEVELOPMENT_DESKTOP_NAME),
      "utf8",
    );
    expect(entry).toContain(
      'Exec="/tools/Electron App/electron" "/repo 100%%/main.js"',
    );
    expect(entry).toContain("Icon=/repo/icon.png");
    expect(entry).toContain("StartupWMClass=company.vectora.vectora.dev\n");
  });

  it("rejects path injection instead of adding another desktop key", () => {
    const dataHome = mkdtempSync(join(tmpdir(), "vectora-desktop-"));
    directories.push(dataHome);
    expect(() =>
      registerDevelopmentDesktop({
        dataHome,
        executable: "/electron",
        main: "/main.js",
        icon: "/icon.png\nExec=malicious",
      }),
    ).toThrow();
  });
});

describe("AppImage command registration", () => {
  it("relaunches through the outer AppImage executable", () => {
    expect(appImageRelaunchOptions("/opt/Vectora.AppImage")).toEqual({
      execPath: "/opt/Vectora.AppImage",
    });
    expect(appImageRelaunchOptions(undefined)).toBeUndefined();
    expect(() => appImageRelaunchOptions("Vectora.AppImage")).toThrow(
      "AppImage relaunch path must be absolute",
    );
  });

  it("adds an idempotent command symlink under the user's local bin", () => {
    const home = mkdtempSync(join(tmpdir(), "vectora-appimage-"));
    directories.push(home);
    const appImage = join(home, "Applications", "Vectora.AppImage");
    mkdirSync(join(home, "Applications"));
    writeFileSync(appImage, "appimage");
    chmodSync(appImage, 0o755);

    registerAppImageCommand({ home, appImage });
    registerAppImageCommand({ home, appImage });

    const command = join(home, ".local", "bin", "vectora");
    expect(lstatSync(command).isSymbolicLink()).toBe(true);
    expect(readlinkSync(command)).toBe(appImage);
  });

  it("does not replace an existing user command", () => {
    const home = mkdtempSync(join(tmpdir(), "vectora-appimage-"));
    directories.push(home);
    const appImage = join(home, "Applications", "Vectora.AppImage");
    const command = join(home, ".local", "bin", "vectora");
    mkdirSync(join(home, "Applications"));
    mkdirSync(join(home, ".local", "bin"), { recursive: true });
    writeFileSync(appImage, "appimage");
    chmodSync(appImage, 0o755);
    writeFileSync(command, "existing command");

    expect(() => registerAppImageCommand({ home, appImage })).toThrow(
      "A different vectora command already exists",
    );
    expect(readFileSync(command, "utf8")).toBe("existing command");
  });
});
