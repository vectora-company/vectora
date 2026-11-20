export type GraphicsSwitch = readonly [name: string, value: string];

export function resolveGraphicsSwitches(
  platform: NodeJS.Platform,
  angleOverride?: string,
): GraphicsSwitch[] {
  const switches: GraphicsSwitch[] = [["use-gl", "angle"]];

  if (angleOverride) {
    switches.push(["use-angle", angleOverride]);
  } else if (platform === "win32") {
    switches.push(["use-angle", "d3d11on12"]);
  } else if (platform === "darwin") {
    switches.push(["use-angle", "metal"]);
  }

  if (platform === "linux") {
    if (angleOverride === "vulkan") {
      switches.push(["enable-features", "Vulkan"]);
    }
    switches.push(["ozone-platform", "x11"]);
  }

  return switches;
}
