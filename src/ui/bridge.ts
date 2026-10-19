import { appError, SaiderError, type AppError } from "../core/errors";
import type { Command, PluginState, ToUi } from "../plugin/messages";

let seq = 0;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
let onState: ((s: PluginState) => void) | null = null;
let onFatal: ((e: AppError) => void) | null = null;

window.addEventListener("message", (e: MessageEvent) => {
  const msg = e.data?.pluginMessage as ToUi | undefined;
  if (!msg) return;
  if (msg.type === "state") onState?.(msg.state);
  if (msg.type === "fatal") onFatal?.(msg.error);
  if (msg.type === "result") {
    const p = pending.get(msg.requestId);
    if (!p) return;
    pending.delete(msg.requestId);
    msg.ok ? p.resolve(msg.data) : p.reject(new SaiderError(msg.error ?? appError("unexpected", { message: "no details" })));
  }
});

export function subscribe(state: (s: PluginState) => void, fatal: (e: AppError) => void) {
  onState = state;
  onFatal = fatal;
}

export function send(command: Command): Promise<unknown> {
  const requestId = ++seq;
  parent.postMessage({ pluginMessage: { requestId, command } }, "*");
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}

export function notify(message: string, error = false) {
  send({ type: "notify", message, error }).catch(() => undefined);
}

export function download(filename: string, text: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
