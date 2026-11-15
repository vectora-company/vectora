"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClientProfile } from "@/lib/hooks/auth";
import { m } from "@/lib/paraglide/messages";

export function ClientProfileSettings() {
  const { clientProfile, hasLoaded, persistenceError, updateClientProfile } =
    useClientProfile();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    // localStorage é carregado pelo hook após a montagem; sincroniza o rascunho
    // do formulário somente depois dessa leitura externa.
    // oxlint-disable-next-line react/set-state-in-effect
    if (hasLoaded) setName(clientProfile.label ?? "");
  }, [clientProfile.label, hasLoaded]);

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const label = name.trim();
    if (!label) {
      setInvalid(true);
      setSaved(false);
      return;
    }

    setInvalid(false);
    updateClientProfile({ label });
    setSaved(true);
  }

  return (
    <section className="space-y-3" aria-labelledby="client-profile-heading">
      <div className="space-y-1">
        <h3
          id="client-profile-heading"
          className="text-xs font-medium uppercase tracking-wide"
        >
          {m.account_client_profile_title()}
        </h3>
        <p className="text-xs text-muted-foreground">
          {m.account_client_profile_description()}
        </p>
      </div>

      <form className="space-y-2" onSubmit={saveProfile}>
        <label
          htmlFor="client-profile-name"
          className="text-xs text-muted-foreground"
        >
          {m.account_client_profile_name()}
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="client-profile-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
              setInvalid(false);
            }}
            maxLength={100}
            autoComplete="off"
            disabled={!hasLoaded}
            placeholder={m.account_client_profile_placeholder()}
            aria-invalid={invalid}
            className="text-sm"
          />
          <Button size="sm" type="submit" disabled={!hasLoaded} className="h-8">
            {m.account_client_profile_save()}
          </Button>
        </div>
        {invalid && (
          <p role="alert" className="text-xs text-destructive">
            {m.account_client_profile_name_required()}
          </p>
        )}
        {saved && !persistenceError && (
          <p role="status" className="text-xs text-muted-foreground">
            {m.account_client_profile_saved()}
          </p>
        )}
        {persistenceError && (
          <p role="alert" className="text-xs text-destructive">
            {m.account_client_profile_storage_error()}
          </p>
        )}
      </form>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          {m.account_client_profile_id()}
        </p>
        <code className="block truncate text-xs" title={clientProfile.id}>
          {hasLoaded ? clientProfile.id : "…"}
        </code>
      </div>
    </section>
  );
}
