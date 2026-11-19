"use client";

/**
 * ToolPolicyPanel — controle do usuário sobre quais tools built-in o agente
 * pode usar em seu nome.
 *
 * GET /tools/policy → {disabled, available, locked}; PUT salva as desabilitadas.
 * O usuário só remove o próprio acesso: o que o admin bloqueou (`locked`)
 * aparece desligado e travado. O admin ainda define, por tool, quais roles
 * podem usá-la (GET/PUT /admin/tool-access).
 * Mudanças entram em vigor no próximo request, que invalida o cache.
 */

import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { m } from "@/lib/paraglide/messages";
import { useAuthStore } from "@/lib/stores/auth-store";
interface Policy {
  disabled: string[];
  available: string[];
  /** Bloqueadas pelo admin (kill-switch ou role): não dá para liberar. */
  locked?: string[];
  schemas?: Record<string, unknown>;
}
import { settingsItemClass } from "@/components/settings/primitives";
import { cn } from "@/lib/utils";

/** Roles que o admin pode liberar por tool; admin e root sempre têm acesso. */
const GRANTABLE_ROLES = ["member", "viewer"] as const;

/** Compara dois conjuntos de roles sem depender da ordem. */
function sameRoles(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((role) => b.includes(role));
}

function roleName(role: string): string {
  const labels: Record<string, string> = {
    root: m.account_role_root(),
    admin: m.account_role_admin(),
    member: m.account_role_member(),
    viewer: m.account_role_viewer(),
  };
  return labels[role] ?? role;
}

export function ToolPolicyPanel() {
  const role = useAuthStore((state) => state.user?.role);
  const isAdmin = role === "root" || role === "admin";
  // Acesso por role do admin: `saved` é o que está gravado, `access` o rascunho.
  const [savedAccess, setSavedAccess] = useState<Record<string, string[]>>({});
  const [access, setAccess] = useState<Record<string, string[]>>({});
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Record<string, number> | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(false);
  const [openSchema, setOpenSchema] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/tools/policy")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.available) {
          setPolicy(d);
          setDisabled(new Set(d.disabled ?? []));
        } else {
          setError(m.toolpolicy_error_load());
        }
      })
      .catch(() => setError(m.toolpolicy_error_load()))
      .finally(() => setLoading(false));
    fetch("/tools/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.usage) setUsage(d.usage);
        else setUsageError(true);
      })
      .catch(() => setUsageError(true))
      .finally(() => setUsageLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    fetch("/admin/tool-access")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { tools?: Array<{ name: string; roles: string[] }> } | null) => {
          if (cancelled || !d?.tools) return;
          const map = Object.fromEntries(d.tools.map((t) => [t.name, t.roles]));
          setSavedAccess(map);
          setAccess(map);
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const toggleRole = (name: string, roleId: string) => {
    setAccess((prev) => {
      const current = prev[name] ?? [...GRANTABLE_ROLES];
      const next = current.includes(roleId)
        ? current.filter((r) => r !== roleId)
        : [...current, roleId];
      return { ...prev, [name]: next };
    });
    setSaved(false);
  };

  const toggle = (name: string) => {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/tools/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: [...disabled] }),
      });
      if (!res.ok) {
        setError(m.toolpolicy_error_save());
        return;
      }
      const changedAccess = Object.fromEntries(
        Object.entries(access).filter(
          ([name, roles]) =>
            !sameRoles(roles, savedAccess[name] ?? GRANTABLE_ROLES),
        ),
      );
      if (isAdmin && Object.keys(changedAccess).length > 0) {
        const accessRes = await fetch("/admin/tool-access", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access: changedAccess }),
        });
        if (!accessRes.ok) {
          setError(m.toolpolicy_error_save());
          return;
        }
        setSavedAccess(access);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError(m.toolpolicy_error_save());
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!policy) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  const dirty = (() => {
    const base = new Set(policy.disabled);
    if (base.size !== disabled.size) return true;
    for (const n of disabled) if (!base.has(n)) return true;
    return false;
  })();
  const accessDirty = Object.entries(access).some(
    ([name, roles]) => !sameRoles(roles, savedAccess[name] ?? GRANTABLE_ROLES),
  );
  const locked = new Set(policy.locked ?? []);

  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{m.toolpolicy_title()}</p>
        <p className="text-xs text-muted-foreground">
          {m.toolpolicy_subtitle()}
        </p>
      </div>

      <div className={cn(settingsItemClass, "divide-y divide-border")}>
        {policy.available.map((name) => {
          const isLocked = locked.has(name);
          const isEnabled = !isLocked && !disabled.has(name);
          const schema = policy.schemas?.[name];
          const grantedRoles = access[name] ?? [...GRANTABLE_ROLES];
          return (
            <div key={name} className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono">{name}</span>
                <span className="flex items-center gap-2">
                  {isLocked && !isAdmin && (
                    <span className="text-2xs text-muted-foreground">
                      {m.toolpolicy_locked()}
                    </span>
                  )}
                  <Switch
                    checked={isEnabled}
                    disabled={isLocked && !isAdmin}
                    onCheckedChange={() => toggle(name)}
                    aria-label={name}
                  />
                </span>
              </div>
              {isAdmin && (
                <fieldset
                  className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                  aria-label={`${m.toolpolicy_roles_label()}: ${name}`}
                >
                  <legend className="sr-only">
                    {m.toolpolicy_roles_label()}
                  </legend>
                  <span className="text-muted-foreground">
                    {m.toolpolicy_roles_label()}
                  </span>
                  {["root", "admin"].map((fixed) => (
                    <label
                      key={fixed}
                      className="inline-flex items-center gap-1 text-muted-foreground"
                      title={m.toolpolicy_roles_always()}
                    >
                      <input type="checkbox" checked disabled />
                      {roleName(fixed)}
                    </label>
                  ))}
                  {GRANTABLE_ROLES.map((roleId) => (
                    <label
                      key={roleId}
                      className="inline-flex items-center gap-1"
                    >
                      <input
                        type="checkbox"
                        checked={grantedRoles.includes(roleId)}
                        onChange={() => toggleRole(name, roleId)}
                      />
                      {roleName(roleId)}
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {usageLoading
                    ? m.toolpolicy_usage_loading()
                    : usageError
                      ? m.toolpolicy_usage_error()
                      : (usage?.[name] ?? 0) === 1
                        ? m.toolpolicy_usage_one({ count: usage?.[name] ?? 0 })
                        : m.toolpolicy_usage_many({
                            count: usage?.[name] ?? 0,
                          })}
                </span>
                {schema !== undefined && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    aria-expanded={openSchema === name}
                    aria-controls={`tool-schema-${name}`}
                    onClick={() =>
                      setOpenSchema(openSchema === name ? null : name)
                    }
                  >
                    {openSchema === name ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {openSchema === name
                      ? m.toolpolicy_hide_schema()
                      : m.toolpolicy_show_schema()}
                  </button>
                )}
              </div>
              {openSchema === name && schema !== undefined && (
                <pre
                  id={`tool-schema-${name}`}
                  role="region"
                  aria-label={m.toolpolicy_schema_label({ name })}
                  className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-2xs"
                >
                  {JSON.stringify(schema, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 justify-end">
        {saved && (
          <span className="text-xs text-success inline-flex items-center gap-1">
            <Check className="w-3 h-3" />
            {m.toolpolicy_saved()}
          </span>
        )}
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={saving || (!dirty && !accessDirty)}
        >
          {saving && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
          {m.toolpolicy_save()}
        </Button>
      </div>
    </div>
  );
}
