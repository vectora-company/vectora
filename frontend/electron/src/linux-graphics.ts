export type LinuxAngleBackend = "default" | "gl" | "vulkan";
export type LinuxOzonePlatform = "auto" | "x11" | "wayland";

export interface LinuxGraphicsEnvironment {
  VECTORA_ANGLE_BACKEND?: string;
  VECTORA_OZONE_PLATFORM?: string;
  VECTORA_EXTERNAL_BACKEND?: string;
}

export interface GraphicsCliOverrides {
  angleBackend?: string;
  ozonePlatform?: string;
  disableGpu?: boolean;
}

export interface LinuxGraphicsConfiguration {
  switches: ReadonlyArray<readonly [name: string, value?: string]>;
}

const ANGLE_BACKENDS = new Set<LinuxAngleBackend>(["default", "gl", "vulkan"]);
const OZONE_PLATFORMS = new Set(["auto", "cosmic", "wayland", "x11"]);

/** Interpreta apenas os overrides gráficos do Vectora; outros argv são dados. */
export function parseGraphicsCliOverrides(
  argv: readonly string[],
): GraphicsCliOverrides {
  const result: GraphicsCliOverrides = {};
  for (const argument of argv) {
    switch (argument.toLowerCase()) {
      case "--vulkan":
        result.angleBackend = "vulkan";
        break;
      case "--gl":
      case "--opengl":
        result.angleBackend = "gl";
        break;
      case "--auto":
      case "--default-gpu":
        result.angleBackend = "default";
        break;
      case "--x11":
        result.ozonePlatform = "x11";
        break;
      case "--wayland":
        result.ozonePlatform = "wayland";
        break;
      case "--cosmic":
        result.ozonePlatform = "cosmic";
        break;
      case "--d3d11":
        result.angleBackend = "d3d11";
        break;
      case "--d3d11on12":
        result.angleBackend = "d3d11on12";
        break;
      case "--d3d9":
        result.angleBackend = "d3d9";
        break;
      case "--metal":
        result.angleBackend = "metal";
        break;
      case "--swiftshader":
        result.angleBackend = "swiftshader";
        break;
      case "--disable-gpu":
        result.disableGpu = true;
        break;
    }
  }
  return result;
}

export function resolveLinuxGraphicsConfiguration(
  env: LinuxGraphicsEnvironment,
): LinuxGraphicsConfiguration {
  const switches: Array<readonly [string, string?]> = [];
  const angle = env.VECTORA_ANGLE_BACKEND?.trim().toLowerCase();
  if (angle && angle !== "default") {
    if (!ANGLE_BACKENDS.has(angle as LinuxAngleBackend)) {
      throw new Error(`VECTORA_ANGLE_BACKEND inválido: ${angle}`);
    }
    switches.push(["use-angle", angle]);
  }
  const ozone = env.VECTORA_OZONE_PLATFORM?.trim().toLowerCase();
  if (ozone && ozone !== "auto") {
    if (!OZONE_PLATFORMS.has(ozone)) {
      throw new Error(`VECTORA_OZONE_PLATFORM inválido: ${ozone}`);
    }
    switches.push(["ozone-platform", ozone === "cosmic" ? "wayland" : ozone]);
  }
  return { switches };
}
