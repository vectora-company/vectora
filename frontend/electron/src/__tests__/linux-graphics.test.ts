import { describe, expect, it } from "vitest";
import { resolveLinuxGraphicsConfiguration } from "../linux-graphics.js";

describe("resolveLinuxGraphicsConfiguration", () => {
  it("usa auto Ozone por padrão para suportar Wayland e X11 sem forçar plataforma", () => {
    // "auto" omite a switch --ozone-platform e deixa o Electron/Chromium detectar.
    // Forçar x11 causava falha de superfície Vulkan no COSMIC/Wayland.
    expect(resolveLinuxGraphicsConfiguration({})).toEqual({
      angleBackend: "vulkan",
      ozonePlatform: "auto",
      switches: [
        ["use-angle", "vulkan"],
        ["ignore-gpu-blocklist"],
        [
          "enable-features",
          "Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder",
        ],
        ["disable-features", "SkiaGraphite"],
        // sem ozone-platform: auto deixa o Electron decidir
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
