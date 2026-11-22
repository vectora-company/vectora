import { describe, expect, it } from "vitest";
import {
  parseGraphicsCliOverrides,
  resolveLinuxGraphicsConfiguration,
} from "../linux-graphics.js";

describe("parseGraphicsCliOverrides", () => {
  it("interpreta flags gráficas sem tratar arquivos como opções", () => {
    expect(
      parseGraphicsCliOverrides(["electron", "main.js", "--vulkan", "--x11"]),
    ).toEqual({ angleBackend: "vulkan", ozonePlatform: "x11" });
    expect(parseGraphicsCliOverrides(["--gl", "--wayland"])).toEqual({
      angleBackend: "gl",
      ozonePlatform: "wayland",
    });
  });

  it("permite que a última flag do mesmo grupo vença", () => {
    expect(parseGraphicsCliOverrides(["--vulkan", "--auto"])).toEqual({
      angleBackend: "default",
    });
  });

  it("reconhece o modo de diagnóstico sem GPU", () => {
    expect(parseGraphicsCliOverrides(["--disable-gpu"])).toEqual({
      disableGpu: true,
    });
  });
});

describe("resolveLinuxGraphicsConfiguration", () => {
  it("deixa o Chromium escolher o backend por padrão", () => {
    // Ozone Wayland não é compatível com Vulkan; sem forçar x11 (via XWayland) a
    // janela nunca abre em sessões Wayland. O Python já fazia isso em dev mode;
    // aqui replicamos o mesmo comportamento para o modo packaged.
    expect(resolveLinuxGraphicsConfiguration({})).toEqual({
      angleBackend: "default",
      ozonePlatform: "auto",
      switches: [],
    });
  });

  it("usa auto quando VECTORA_ANGLE_BACKEND=default sem ozone explícito", () => {
    expect(
      resolveLinuxGraphicsConfiguration({ VECTORA_ANGLE_BACKEND: "default" }),
    ).toEqual({
      angleBackend: "default",
      ozonePlatform: "auto",
      switches: [],
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

  it("mantém Ozone quando o Electron é anexado ao backend Python", () => {
    expect(
      resolveLinuxGraphicsConfiguration({
        VECTORA_EXTERNAL_BACKEND: "1",
        VECTORA_OZONE_PLATFORM: "wayland",
      }).switches,
    ).toContainEqual(["ozone-platform", "wayland"]);
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
