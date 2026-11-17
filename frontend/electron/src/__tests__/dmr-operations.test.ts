import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DmrOperations } from "../dmr-operations.js";
import type { DockerCliExecutor } from "../docker-cli-executor.js";

const executors: Array<{ dispose: () => void }> = [];

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(predicate()).toBe(true);
}

afterEach(() => {
  for (const executor of executors.splice(0)) executor.dispose();
});

describe("Electron DMR operation lifecycle", () => {
  it("instala o plugin de sistema e o runner quando ambos faltam", async () => {
    let pluginInstalled = false;
    let runnerInstalled = false;
    const executor = {
      canInstallPlugin: vi.fn(() => true),
      execute: vi.fn(async (operation: string) => ({
        operationId: operation,
        code:
          operation === "version" && !pluginInstalled
            ? 1
            : operation === "status" && !runnerInstalled
              ? 1
              : 0,
        signal: null,
        stdout:
          operation === "info"
            ? JSON.stringify({ OperatingSystem: "Ubuntu Linux" })
            : operation === "version"
              ? pluginInstalled
                ? "v1"
                : "docker: unknown command: model"
              : operation === "status"
                ? runnerInstalled
                  ? JSON.stringify({ status: "running" })
                  : "Docker Model Runner is not installed"
                : operation === "installPlugin"
                  ? ((pluginInstalled = true), "installed")
                  : operation === "installRunner"
                    ? ((runnerInstalled = true), "installed")
                    : "",
        stderr: "",
      })),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    await expect(operations.detect()).resolves.toMatchObject({
      status: "plugin_unavailable",
      pluginInstallSupported: true,
    });
    const initial = await operations.ensureRunner();
    await waitFor(() =>
      ["completed", "failed"].includes(
        operations.getOperation(initial.id)?.status ?? "",
      ),
    );
    expect(operations.getOperation(initial.id)).toMatchObject({
      status: "completed",
      operation: "install_plugin",
    });
    expect(
      executor.execute.mock.calls.map(([operation]) => operation),
    ).toContain("installPlugin");
    expect(
      executor.execute.mock.calls.map(([operation]) => operation),
    ).toContain("installRunner");
    await rm(directory, { recursive: true, force: true });
  });

  it("does not infer runner readiness from docker info alone", async () => {
    const executor = {
      execute: vi.fn(async (operation: string) => ({
        operationId: operation,
        code: operation === "status" ? 1 : 0,
        signal: null,
        stdout:
          operation === "info"
            ? JSON.stringify({ OperatingSystem: "Docker Engine" })
            : operation === "status"
              ? "Docker Model Runner is not running"
              : "v1",
        stderr: "",
      })),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    await expect(operations.detect()).resolves.toMatchObject({
      status: "stopped",
      docker: true,
      plugin: true,
      runner: false,
    });
    expect(executor.execute.mock.calls.map(([operation]) => operation)).toEqual(
      ["info", "version", "status"],
    );
    await rm(directory, { recursive: true, force: true });
  });

  it("ativa o runner com o comando correto para Docker Desktop", async () => {
    let runnerEnabled = false;
    const executor = {
      execute: vi.fn(async (operation: string) => ({
        operationId: operation,
        code: operation === "status" && !runnerEnabled ? 1 : 0,
        signal: null,
        stdout:
          operation === "info"
            ? JSON.stringify({ OperatingSystem: "Docker Desktop" })
            : operation === "status"
              ? JSON.stringify({ status: "running" })
              : operation === "enableModelRunner"
                ? ((runnerEnabled = true), "enabled")
                : "v1",
        stderr: "",
      })),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    const initial = await operations.ensureRunner();
    await waitFor(() =>
      ["completed", "failed"].includes(
        operations.getOperation(initial.id)?.status ?? "",
      ),
    );
    expect(operations.getOperation(initial.id)).toMatchObject({
      status: "completed",
    });
    expect(executor.execute).toHaveBeenCalledWith(
      "enableModelRunner",
      undefined,
      undefined,
      expect.objectContaining({ operationId: initial.id }),
    );
    await rm(directory, { recursive: true, force: true });
  });

  it("inicia o runner Engine já instalado em vez de reinstalá-lo", async () => {
    let runnerStarted = false;
    const executor = {
      execute: vi.fn(async (operation: string) => ({
        operationId: operation,
        code: 0,
        signal: null,
        stdout:
          operation === "info"
            ? JSON.stringify({ OperatingSystem: "Ubuntu Linux" })
            : operation === "status"
              ? JSON.stringify({
                  status: runnerStarted ? "running" : "stopped",
                })
              : operation === "startRunner"
                ? ((runnerStarted = true), "started")
                : "v1",
        stderr: "",
      })),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    const initial = await operations.ensureRunner();
    await waitFor(() =>
      ["completed", "failed"].includes(
        operations.getOperation(initial.id)?.status ?? "",
      ),
    );
    expect(operations.getOperation(initial.id)).toMatchObject({
      status: "completed",
    });
    expect(initial.operation).toBe("start_runner");
    expect(executor.execute).toHaveBeenCalledWith(
      "startRunner",
      undefined,
      undefined,
      expect.objectContaining({ operationId: initial.id }),
    );
    expect(executor.execute).not.toHaveBeenCalledWith(
      "installRunner",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    await rm(directory, { recursive: true, force: true });
  });

  it("instala o runner Engine quando o status confirma que falta instalar", async () => {
    let runnerInstalled = false;
    const executor = {
      execute: vi.fn(async (operation: string) => ({
        operationId: operation,
        code: operation === "status" && !runnerInstalled ? 1 : 0,
        signal: null,
        stdout:
          operation === "info"
            ? JSON.stringify({ OperatingSystem: "Ubuntu Linux" })
            : operation === "status"
              ? runnerInstalled
                ? JSON.stringify({ status: "running" })
                : "Docker Model Runner is not installed"
              : operation === "installRunner"
                ? ((runnerInstalled = true), "installed")
                : "v1",
        stderr: "",
      })),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    const initial = await operations.ensureRunner();
    await waitFor(() =>
      ["completed", "failed"].includes(
        operations.getOperation(initial.id)?.status ?? "",
      ),
    );
    expect(operations.getOperation(initial.id)).toMatchObject({
      status: "completed",
      operation: "install_runner",
    });
    expect(executor.execute).toHaveBeenCalledWith(
      "installRunner",
      undefined,
      undefined,
      expect.objectContaining({ operationId: initial.id }),
    );
    await rm(directory, { recursive: true, force: true });
  });

  it("returns a pollable operation before the Docker command completes", async () => {
    const release = vi.fn<() => void>();
    let resolvePull: (() => void) | undefined;
    const pull = new Promise<void>((resolve) => {
      resolvePull = resolve;
    });
    const executor = {
      execute: vi.fn(async (operation: string) => {
        if (operation === "pull") await pull;
        return {
          operationId: "operation",
          code: 0,
          signal: null,
          stdout: "ok",
          stderr: "",
        };
      }),
      cancel: vi.fn(() => false),
      dispose: release,
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    const initial = await operations.prepare("hf.co/Qwen/Qwen3-0.6B");
    expect(["queued", "running"]).toContain(initial.status);
    expect(operations.getOperation(initial.id)?.status).not.toBe("completed");
    expect(operations.listOperations()).toEqual([
      expect.objectContaining({ id: initial.id, status: initial.status }),
    ]);

    resolvePull?.();
    await waitFor(
      () => operations.getOperation(initial.id)?.status === "completed",
    );
    expect(operations.getOperation(initial.id)?.progress).toBe(100);

    await rm(directory, { recursive: true, force: true });
  });

  it("marks a running operation cancelled and prevents manifest activation", async () => {
    let resolvePull: (() => void) | undefined;
    const pull = new Promise<void>((resolve) => {
      resolvePull = resolve;
    });
    const executor = {
      execute: vi.fn(async () => {
        await pull;
        return {
          operationId: "operation",
          code: 0,
          signal: null,
          stdout: "ok",
          stderr: "",
        };
      }),
      cancel: vi.fn(() => true),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    const initial = await operations.prepare("hf.co/Qwen/Qwen3-0.6B");
    await waitFor(
      () => operations.getOperation(initial.id)?.status === "running",
    );
    expect(operations.cancel(initial.id)).toBe(true);
    expect(operations.getOperation(initial.id)?.status).toBe("cancelled");

    resolvePull?.();
    await waitFor(
      () => operations.getOperation(initial.id)?.phase === "cancelled",
    );
    expect((await operations.list()).models).toEqual({});
    await rm(directory, { recursive: true, force: true });
  });

  it("cancels a queued operation before its executor starts", async () => {
    const executor = {
      execute: vi.fn(async () => ({
        operationId: "operation",
        code: 0,
        signal: null,
        stdout: "ok",
        stderr: "",
      })),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );
    const initial = await operations.prepare("hf.co/Qwen/Qwen3-0.6B");
    expect(operations.cancel(initial.id)).toBe(true);
    await waitFor(
      () => operations.getOperation(initial.id)?.phase === "cancelled",
    );
    expect(executor.execute).not.toHaveBeenCalled();
    await rm(directory, { recursive: true, force: true });
  });

  it("retains active operations while pruning old terminal operations", async () => {
    let releaseActive: (() => void) | undefined;
    const activePull = new Promise<void>((resolve) => {
      releaseActive = resolve;
    });
    const executor = {
      execute: vi.fn(async (_operation: string, reference?: string) => {
        if (reference === "hf.co/active") await activePull;
        return {
          operationId: "operation",
          code: 0,
          signal: null,
          stdout: "ok",
          stderr: "",
        };
      }),
      cancel: vi.fn(() => false),
      dispose: vi.fn(),
    };
    executors.push(executor);
    const directory = await mkdtemp(join(tmpdir(), "vectora-dmr-"));
    const operations = new DmrOperations(
      executor as unknown as DockerCliExecutor,
      directory,
    );

    const active = await operations.prepare("hf.co/active");
    await waitFor(
      () => operations.getOperation(active.id)?.status === "running",
    );
    for (let index = 0; index < 51; index += 1) {
      const operation = await operations.prepare(`hf.co/model-${index}`);
      await waitFor(
        () => operations.getOperation(operation.id)?.status === "completed",
      );
    }
    expect(operations.getOperation(active.id)).toBeDefined();
    expect(operations.listOperations()).toHaveLength(51);
    releaseActive?.();
    await rm(directory, { recursive: true, force: true });
  });
});
