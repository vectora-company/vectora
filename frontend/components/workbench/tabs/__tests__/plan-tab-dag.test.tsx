// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

import { DAGPlanCard } from "../plan-tab";

const plan = {
  plan_id: "plan-1",
  run_id: "run-1",
  workspace_id: null,
  stages: [
    {
      stage_id: "first",
      name: "Inspect the project",
      depends_on: [],
      status: "pending",
      attempt: 0,
      error: null,
      output: null,
    },
  ],
  plan_hash: "a".repeat(64),
  status: "draft" as const,
  approved_by: null,
  approved_at: null,
  created_at: "2026-11-14T00:00:00Z",
  execution: null,
};

describe("DAGPlanCard", () => {
  it("shows the proposed stages and exposes human approval", () => {
    const onApprove = vi.fn();
    render(
      <DAGPlanCard
        plan={plan}
        busy={false}
        error={null}
        onApprove={onApprove}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("Inspect the project")).toBeTruthy();
    fireEvent.click(screen.getByText("workbench_dag_approve"));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("exposes cancellation only while the execution is active", () => {
    const onCancel = vi.fn();
    render(
      <DAGPlanCard
        plan={{
          ...plan,
          status: "approved",
          execution: {
            execution_id: "exec-1",
            status: "running",
            stages: plan.stages,
          },
        }}
        busy={false}
        error={null}
        onApprove={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByText("workbench_dag_cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
