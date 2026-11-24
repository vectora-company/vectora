import { describe, expect, it, vi } from "vitest";
import { createGraphicsInfoReporter } from "../graphics-info.js";

describe("createGraphicsInfoReporter", () => {
  it("does not query GPU when diagnostics are disabled", async () => {
    const getInfo = vi.fn().mockResolvedValue({ devices: [] });
    const log = vi.fn();
    const warn = vi.fn();
    const report = createGraphicsInfoReporter({
      enabled: false,
      getInfo,
      log,
      warn,
    });

    await report("app-ready");
    await report("gpu-info-update");

    expect(getInfo).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("queries and logs only once after repeated Chromium notifications", async () => {
    const info = { devices: [{ vendor: "Chromium report" }] };
    const getInfo = vi.fn().mockResolvedValue(info);
    const log = vi.fn();
    const warn = vi.fn();
    const report = createGraphicsInfoReporter({
      enabled: true,
      getInfo,
      log,
      warn,
    });

    await Promise.all([
      report("app-ready"),
      report("gpu-info-update"),
      report("gpu-info-update"),
    ]);

    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledExactlyOnceWith("app-ready", info);
    expect(warn).not.toHaveBeenCalled();
  });

  it("reports a query error only once", async () => {
    const error = new Error("GPU query failed");
    const getInfo = vi.fn().mockRejectedValue(error);
    const log = vi.fn();
    const warn = vi.fn();
    const report = createGraphicsInfoReporter({
      enabled: true,
      getInfo,
      log,
      warn,
    });

    await Promise.all([report("app-ready"), report("gpu-info-update")]);

    expect(getInfo).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledExactlyOnceWith("app-ready", error);
    expect(log).not.toHaveBeenCalled();
  });
});
