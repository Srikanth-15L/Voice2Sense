function resolveHelpUrl(): string {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (base) return `${base}/help`;
  return "/api/help";
}

export type HelpChatPurpose = "general" | "relay";

export async function postHelpMessage(
  text: string,
  history: { role: string; content: string }[],
  context: Record<string, unknown>,
  purpose: HelpChatPurpose = "relay"
): Promise<string> {
  const res = await fetch(resolveHelpUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: text,
      history,
      context: { ...context, chatPurpose: purpose },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    answer?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Help request failed (${res.status})`);
  }
  return data.answer ?? "";
}
