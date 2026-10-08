/**
 * Minimal Discord webhook notifier.
 *
 * Discord is optional: when `DISCORD_WEBHOOK_URL` is empty every function is a
 * no-op, and delivery problems are logged but never thrown so monitoring is not
 * affected by a failing webhook.
 */

const COLORS = {
  info: 0x3f5f48,
  success: 0x4ade80,
  warning: 0xfacc15,
  error: 0xf87171,
} as const;

export type NotificationLevel = keyof typeof COLORS;

export interface Notification {
  title: string;
  description: string;
  level: NotificationLevel;
  /** Optional footer text, e.g. the service name. */
  footer?: string;
}

export type NotifyFn = (notification: Notification) => Promise<void>;

/** Creates a notifier for the given webhook URL. */
export function createNotifier(webhookUrl: string | undefined): NotifyFn {
  const url = webhookUrl?.trim();

  if (!url) {
    return async () => {};
  }

  return async (notification: Notification) => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: "Status Page",
          embeds: [
            {
              title: notification.title,
              description: notification.description,
              color: COLORS[notification.level],
              footer: notification.footer
                ? { text: notification.footer }
                : undefined,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn(
          `[discord] webhook responded with ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[discord] failed to send notification: ${message}`);
    }
  };
}
