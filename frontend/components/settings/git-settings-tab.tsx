"use client";

import { useSettingsStore } from "@/lib/stores/settings-store";
import { m } from "@/lib/paraglide/messages";
import {
  settingsItemClass,
  SettingsStack,
  SettingsTabHeader,
} from "@/components/settings/primitives";
import { cn } from "@/lib/utils";

export function GitSettingsTab() {
  const hooks = useSettingsStore((s) => s.gitHooksEnabled);
  const signoff = useSettingsStore((s) => s.gitSignoffEnabled);
  const bypass = useSettingsStore((s) => s.gitBypassEnabled);
  const setHooks = useSettingsStore((s) => s.setGitHooksEnabled);
  const setSignoff = useSettingsStore((s) => s.setGitSignoffEnabled);
  const setBypass = useSettingsStore((s) => s.setGitBypassEnabled);
  return (
    <SettingsStack className="max-w-xl">
      <SettingsTabHeader
        title={m.settings_category_git()}
        description={m.settings_git_description()}
      />
      <label className={cn(settingsItemClass, "flex items-start gap-3 p-3")}>
        <input
          type="checkbox"
          checked={hooks}
          onChange={(e) => setHooks(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">
            {m.settings_git_hooks()}
          </span>
          <span className="block text-xs text-muted-foreground">
            {m.settings_git_hooks_description()}
          </span>
        </span>
      </label>
      <label className={cn(settingsItemClass, "flex items-start gap-3 p-3")}>
        <input
          type="checkbox"
          checked={signoff}
          onChange={(e) => setSignoff(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">
            {m.settings_git_signoff()}
          </span>
          <span className="block text-xs text-muted-foreground">
            {m.settings_git_signoff_description()}
          </span>
        </span>
      </label>
      <label className={cn(settingsItemClass, "flex items-start gap-3 p-3")}>
        <input
          type="checkbox"
          checked={bypass}
          onChange={(e) => setBypass(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium">
            {m.settings_git_bypass()}
          </span>
          <span className="block text-xs text-muted-foreground">
            {m.settings_git_bypass_description()}
          </span>
        </span>
      </label>
    </SettingsStack>
  );
}
