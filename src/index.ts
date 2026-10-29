/**
 * Bridge Pi's extension UI waiting span to the Herdr-managed integration.
 * Herdr remains responsible for lifecycle reporting, sounds and notifications.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function herdrBridge(pi: ExtensionAPI) {
  if (
    process.env.HERDR_ENV !== "1" ||
    !process.env.HERDR_SOCKET_PATH ||
    !process.env.HERDR_PANE_ID
  ) {
    return;
  }

  let sessionActive = false;
  let blocked = false;

  function clearBlock() {
    if (!blocked) return;
    blocked = false;
    pi.events.emit("herdr:blocked", { active: false });
  }

  pi.on("session_start", (_event, ctx) => {
    clearBlock();
    sessionActive = ctx.mode === "tui";
  });

  pi.on("ui_prompt_start", (_event, ctx) => {
    if (!sessionActive || ctx.mode !== "tui" || blocked) return;
    // Pi coalesces nested/overlapping dialogs into one outer waiting span.
    blocked = true;
    // Keep dialog titles, commands and paths out of status reports.
    pi.events.emit("herdr:blocked", {
      active: true,
      label: "Waiting for your response",
    });
  });

  pi.on("ui_prompt_end", () => clearBlock());

  pi.on("session_shutdown", () => {
    sessionActive = false;
    clearBlock();
  });
}
