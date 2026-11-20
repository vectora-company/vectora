import { describe, expect, it } from "vitest";
import { resolveGraphicsSwitches } from "../graphics-config.js";

describe("Electron graphics switches", () => {
  it("leaves Linux backend selection to Chromium by default", () => {
    expect(resolveGraphicsSwitches("linux")).toEqual([
      ["use-gl", "angle"],
      ["ozone-platform", "x11"],
    ]);
  });

  it("enables Vulkan only when explicitly selected on Linux", () => {
    expect(resolveGraphicsSwitches("linux", "vulkan")).toEqual([
      ["use-gl", "angle"],
      ["use-angle", "vulkan"],
      ["enable-features", "Vulkan"],
      ["ozone-platform", "x11"],
    ]);
    expect(resolveGraphicsSwitches("linux", "gl")).not.toContainEqual([
      "enable-features",
      "Vulkan",
    ]);
  });

  it("keeps the existing platform-specific ANGLE defaults", () => {
    expect(resolveGraphicsSwitches("win32")).toContainEqual([
      "use-angle",
      "d3d11on12",
    ]);
    expect(resolveGraphicsSwitches("darwin")).toContainEqual([
      "use-angle",
      "metal",
    ]);
  });
});
