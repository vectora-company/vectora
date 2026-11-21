/**
 * Tempo relativo curto ("há 5 minutos") no idioma do navegador. O instante de
 * referência (`now`) é um parâmetro: quem lista várias linhas passa o mesmo
 * valor a todas, para duas linhas nunca discordarem sobre a mesma data.
 */

const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 365 * 24 * 3600 },
  { unit: "month", seconds: 30 * 24 * 3600 },
  { unit: "week", seconds: 7 * 24 * 3600 },
  { unit: "day", seconds: 24 * 3600 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

/** Menos que isso é "agora há pouco", sem número. */
const JUST_NOW_SECONDS = 45;

const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });

/**
 * O texto relativo de `iso` em relação a `now`, ou `null` quando a data é
 * inválida ou está a menos de ~45 s (quem chama mostra "agora há pouco").
 * Datas no futuro saem como "em 3 minutos".
 */
export function formatRelativeTime(iso: string, now: number): string | null {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  const diffSeconds = Math.round((time - now) / 1000);
  if (Math.abs(diffSeconds) < JUST_NOW_SECONDS) return null;
  for (const { unit, seconds } of UNITS) {
    if (Math.abs(diffSeconds) >= seconds)
      return formatter.format(Math.trunc(diffSeconds / seconds), unit);
  }
  return formatter.format(Math.trunc(diffSeconds / 60), "minute");
}
