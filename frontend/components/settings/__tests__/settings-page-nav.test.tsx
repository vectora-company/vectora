// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, key) => () => String(key) }),
}));

import { SettingsPageNav, SettingsSection, SettingsStack } from "../primitives";

describe("SettingsPageNav", () => {
  it("lista os cards da aba e rola até o escolhido", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <SettingsStack>
        <SettingsPageNav />
        <SettingsSection title="Alfa">a</SettingsSection>
        <SettingsSection title="Beta">b</SettingsSection>
      </SettingsStack>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it("fica oculto com um card só", () => {
    render(
      <SettingsStack>
        <SettingsPageNav />
        <SettingsSection title="Único">a</SettingsSection>
      </SettingsStack>,
    );

    expect(screen.queryByRole("button", { name: "Único" })).toBeNull();
  });
});
