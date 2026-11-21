import { describe, expect, it } from "vitest";
import { resolveLinuxGraphicsConfiguration } from "../linux-graphics.js";

describe("resolveLinuxGraphicsConfiguration", () => {
  it("preserves the current Vulkan on X11 default", () => {
    expect(resolveLinuxGraphicsConfiguration({})).toEqual({
      angleBackend: "vulkan",
      ozonePlatform: "x11",
      switches: [
        ["use-angle", "vulkan"],
        ["ignore-gpu-blocklist"],
        [
          "enable-features",
          "Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder",
        ],
        ["disable-features", "SkiaGraphite"],
        ["ozone-platform", "x11"],
      ],
    });
  });

  it("maps COSMIC to Wayland and allows ANGLE OpenGL", () => {
    expect(
      resolveLinuxGraphicsConfiguration({
        VECTORA_ANGLE_BACKEND: "gl",
        VECTORA_OZONE_PLATFORM: "cosmic",
      }),
    ).toEqual({
      angleBackend: "gl",
      ozonePlatform: "wayland",
      switches: [
        ["use-angle", "gl"],
        ["ozone-platform", "wayland"],
      ],
    });
  });

  it("leaves Ozone and ANGLE selection to Electron in auto/default mode", () => {
    expect(
      resolveLinuxGraphicsConfiguration({
        VECTORA_ANGLE_BACKEND: "default",
        VECTORA_OZONE_PLATFORM: "auto",
      }),
    ).toEqual({
      angleBackend: "default",
      ozonePlatform: "auto",
      switches: [],
    });
  });

  it("does not duplicate the Ozone command-line switch for the Python sidecar", () => {
    expect(
      resolveLinuxGraphicsConfiguration({
        VECTORA_EXTERNAL_BACKEND: "1",
        VECTORA_OZONE_PLATFORM: "wayland",
      }).switches,
    ).not.toContainEqual(["ozone-platform", "wayland"]);
  });

  it("rejects unsupported renderer values instead of silently falling back", () => {
    expect(() =>
      resolveLinuxGraphicsConfiguration({
        VECTORA_ANGLE_BACKEND: "swiftshader",
      }),
    ).toThrow("Use default, gl ou vulkan");
    expect(() =>
      resolveLinuxGraphicsConfiguration({ VECTORA_OZONE_PLATFORM: "mir" }),
    ).toThrow("Use auto, x11, wayland ou cosmic");
  });
});
