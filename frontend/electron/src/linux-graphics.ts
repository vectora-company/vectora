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
  angleBackend: LinuxAngleBackend;
  ozonePlatform: LinuxOzonePlatform;
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

function isAngleBackend(value: string): value is LinuxAngleBackend {
  return ANGLE_BACKENDS.has(value as LinuxAngleBackend);
}

function isOzonePlatform(
  value: string,
): value is "auto" | "cosmic" | "wayland" | "x11" {
  return OZONE_PLATFORMS.has(value);
}

export function resolveLinuxGraphicsConfiguration(
  env: LinuxGraphicsEnvironment,
): LinuxGraphicsConfiguration {
  const requestedAngle = env.VECTORA_ANGLE_BACKEND?.trim().toLowerCase();
  // Não force Vulkan por padrão: o Chromium precisa consultar o driver e
  // escolher um backend utilizável. Vulkan continua disponível por override.
  const angleBackend = requestedAngle || "default";
  if (!isAngleBackend(angleBackend)) {
    throw new Error(
      `VECTORA_ANGLE_BACKEND inválido: ${angleBackend}. Use default, gl ou vulkan.`,
    );
  }

  const requestedOzone = env.VECTORA_OZONE_PLATFORM?.trim().toLowerCase();
  // Quando o Vulkan está ativo (padrão), o Chromium com Ozone Wayland falha na
  // criação da superfície ("not compatible with Vulkan") e a janela nunca abre.
  // O Python já força x11 ao spawnar o Electron em dev; replicamos aqui para o
  // modo packaged. Usuários em COSMIC/Wayland puro podem sobrescrever com
  // VECTORA_OZONE_PLATFORM=wayland e VECTORA_ANGLE_BACKEND=gl.
  const ozone = requestedOzone || (angleBackend === "vulkan" ? "x11" : "auto");
  if (!isOzonePlatform(ozone)) {
    throw new Error(
      `VECTORA_OZONE_PLATFORM inválido: ${ozone}. Use auto, x11, wayland ou cosmic.`,
    );
  }
  // COSMIC é um ambiente gráfico, não um backend Ozone próprio do Chromium.
  const ozonePlatform: LinuxOzonePlatform =
    ozone === "cosmic" ? "wayland" : ozone;
  const switches: Array<readonly [string, string?]> = [];
  if (angleBackend !== "default") {
    switches.push(["use-angle", angleBackend]);
  }
  if (angleBackend === "vulkan") {
    switches.push(
      ["ignore-gpu-blocklist"],
      [
        "enable-features",
        "Vulkan,VulkanFromANGLE,DefaultANGLEVulkan,VaapiVideoDecoder",
      ],
      ["disable-features", "SkiaGraphite"],
    );
  }
  // O Electron externo também precisa aplicar Ozone; o Python só é o dono
  // do backend nesse modo e não controla o processo Chromium.
  if (ozonePlatform !== "auto") {
    switches.push(["ozone-platform", ozonePlatform]);
  }

  return {
    angleBackend,
    ozonePlatform,
    switches,
  };
}
