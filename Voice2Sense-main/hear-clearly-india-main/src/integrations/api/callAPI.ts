function resolveCallUrl(): string {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (base) return `${base}/call`;
  return "/api/call";
}

/**
 * Initiates an outbound PSTN call via the backend Twilio service.
 */
export async function postDialCall(to: string, lang?: string): Promise<{ sid: string; status: string }> {
  const url = `${resolveCallUrl()}/dial`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, lang }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    hint?: string;
    missing?: string[];
  };
  if (!res.ok) {
    let msg = data.error || `Dialing failed (${res.status})`;
    if (data.code) msg += ` [${data.code}]`;
    if (data.missing?.length) msg += ` — set: ${data.missing.join(", ")}`;
    if (data.hint) msg += ` (resolved base: ${data.hint})`;
    throw new Error(msg);
  }
  return data as { sid: string; status: string };
}

/**
 * Injects text into an active phone call to be spoken by AI.
 */
export async function postSpeakIntoCall(sid: string, text: string, lang?: string): Promise<{ ok: boolean }> {
  const url = `${resolveCallUrl()}/speak`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid, text, lang }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Speak failed (${res.status})`);
  return data;
}
