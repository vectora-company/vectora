"use client";

import { useEffect, useState } from "react";

import { m } from "@/lib/paraglide/messages";
import { settingsItemClass } from "@/components/settings/primitives";
import { cn } from "@/lib/utils";

type ChannelStatus = "available" | "build_only" | "planned";

interface Channel {
  id: string;
  name: string;
  status: ChannelStatus;
  note: string;
}

function statusLabel(status: ChannelStatus): string {
  if (status === "available") return m.distribution_status_available();
  if (status === "build_only") return m.distribution_status_build_only();
  return m.distribution_status_planned();
}

/** Canais de distribuição e o que cada um realmente oferece hoje. */
export function DistributionChannels() {
  const [channels, setChannels] = useState<Channel[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/distribution/channels", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Channel[] | null) => {
        if (!cancelled && Array.isArray(data)) setChannels(data);
      })
      .catch(() => {
        // Sem a lista a seção simplesmente não aparece.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!channels || channels.length === 0) return null;
  return (
    <section data-testid="distribution-channels" className="space-y-2">
      <h3 className="text-xs font-medium">{m.distribution_channels_title()}</h3>
      <ul className="space-y-1.5">
        {channels.map((channel) => (
          <li
            key={channel.id}
            className={cn(settingsItemClass, "flex flex-col gap-0.5 p-3")}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{channel.name}</span>
              <span
                data-status={channel.status}
                className={cn(
                  "rounded-full px-2 py-0.5 text-2xs",
                  channel.status === "available"
                    ? "bg-git-success/10 text-git-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {statusLabel(channel.status)}
              </span>
            </div>
            <p className="text-2xs text-muted-foreground">{channel.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
