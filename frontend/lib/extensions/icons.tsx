import {
  BarChart3,
  Bot,
  Box,
  Code2,
  Database,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Music,
  Palette,
  Puzzle,
  Rocket,
  Settings,
  Sparkles,
  Terminal,
  Video,
  Wrench,
  Zap,
} from "lucide-react";
import { createElement } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * Ícones que uma extensão pode pedir pelo nome. A lista é fechada de propósito:
 * a extensão escolhe entre ícones do app e nunca entrega imagem nem código.
 */
const ICONS: Record<string, LucideIcon> = {
  "bar-chart": BarChart3,
  bot: Bot,
  box: Box,
  code: Code2,
  database: Database,
  file: FileText,
  globe: Globe,
  image: ImageIcon,
  layers: Layers,
  layout: LayoutDashboard,
  music: Music,
  palette: Palette,
  puzzle: Puzzle,
  rocket: Rocket,
  settings: Settings,
  sparkles: Sparkles,
  terminal: Terminal,
  video: Video,
  wrench: Wrench,
  zap: Zap,
};

export function extensionIcon(name: string | null | undefined): LucideIcon {
  return (name ? ICONS[name] : undefined) ?? Puzzle;
}

/** Ícone pelo nome, como elemento: serve onde o ícone é escolhido em tempo de render. */
export function ExtensionIcon({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  return createElement(extensionIcon(name), { className, "aria-hidden": true });
}
