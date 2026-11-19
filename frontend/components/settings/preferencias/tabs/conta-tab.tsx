"use client";

/**
 * ContaTab
 *
 * Tudo o que é da pessoa que usa o Vectora: perfil (nome, usuário, role e a
 * identidade local), segurança, assinatura e informações do app. O nome é
 * editável inline (PATCH /auth/me) e aceita UTF-8 livre, espaços e acentos.
 * O botão de mudar senha continua placeholder.
 */

import { Check, Loader2, LogOut, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AboutPanel } from "@/components/settings/about-panel";
import { BillingPanel } from "@/components/settings/billing-panel";
import {
  SettingsMessage,
  SettingsSection,
  SettingsStack,
  SettingsTabHeader,
} from "@/components/settings/primitives";
import { useAuthStore } from "@/lib/stores/auth-store";
import { m } from "@/lib/paraglide/messages";
import type { AuthUser } from "@/lib/types/auth";
import { ClientProfileSettings } from "./client-profile-settings";

const ROLE_VARIANTS: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  root: "destructive",
  admin: "default",
  member: "secondary",
  viewer: "outline",
};

function roleLabel(role: string): string {
  switch (role) {
    case "root":
      return m.account_role_root();
    case "admin":
      return m.account_role_admin();
    case "member":
      return m.account_role_member();
    case "viewer":
      return m.account_role_viewer();
    default:
      return role;
  }
}

export function ContaTab() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearUser = useAuthStore((s) => s.clearUser);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `draft` sincroniza com `user?.name` quando ele muda por fora (ex.: outra
  // aba salvou o nome) mas continua editável localmente enquanto o usuário
  // digita — comparação durante o render (não num effect) é o padrão que o
  // próprio React recomenda pra "ajustar estado quando uma prop muda":
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevUserName, setPrevUserName] = useState(user?.name ?? "");
  if ((user?.name ?? "") !== prevUserName) {
    setPrevUserName(user?.name ?? "");
    setDraft(user?.name ?? "");
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <p className="text-sm text-muted-foreground">{m.account_no_user()}</p>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `${res.status}`);
      }
      const updated = (await res.json()) as AuthUser;
      setUser(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.account_save_error());
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      // Ignora erro de rede — limpa localmente de qualquer jeito
    }
    clearUser();
    router.replace("/auth/signin");
  }

  // O backend sempre injeta um usuário em /auth/me (real no Pro, virtual
  // "local" no Free — ver _get_virtual_local_user em
  // backend/api/middleware/auth.py) — só "Sair" distingue conta real de
  // usuário local virtual (sair de uma sessão local não faz sentido).
  const isRealAccount = isAuthenticated && user.id !== "local";

  const displayName = user.name?.trim() || "—";

  return (
    <SettingsStack>
      <SettingsTabHeader
        title={m.settings_category_conta()}
        description={m.account_description()}
      />

      <SettingsSection
        title={m.account_profile_title()}
        description={m.account_profile_description()}
      >
        {/* Nome */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {m.account_name_label()}
          </p>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder={m.account_name_placeholder()}
                className="text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setDraft(user.name ?? "");
                  }
                }}
              />
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(user.name ?? "");
                  setError(null);
                }}
                disabled={saving}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="flex-1 truncate text-sm">{displayName}</p>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3" />
                {m.account_edit()}
              </Button>
            </div>
          )}
          {error && <SettingsMessage tone="danger">{error}</SettingsMessage>}
        </div>

        {/* Usuário + Role — Vectora identifica a conta por username, não email
            (email é opcional e fica vazio em modo local, sem conta). */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              {m.account_username_label()}
            </p>
            <p className="font-mono text-sm">{user.username}</p>
          </div>
          <Badge variant={ROLE_VARIANTS[user.role] ?? "secondary"}>
            {roleLabel(user.role)}
          </Badge>
        </div>
      </SettingsSection>

      <ClientProfileSettings />

      <SettingsSection title={m.account_security()}>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          disabled
          title={m.account_coming_soon()}
        >
          {m.account_change_password()}
        </Button>
        {isRealAccount && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => void handleLogout()}
          >
            <LogOut className="size-3.5" />
            {m.user_logout()}
          </Button>
        )}
      </SettingsSection>

      <SettingsSection title={m.settings_category_billing()}>
        <BillingPanel />
      </SettingsSection>

      <SettingsSection title={m.settings_category_about()}>
        <AboutPanel />
      </SettingsSection>
    </SettingsStack>
  );
}
