// ─── Connector Change Bus ────────────────────────────────────────────────────
// Tiny, dependency-free pub/sub used by `useOpenCodeStore` to notify other
// stores (prompt-gen, workflow-gen, …) and hooks (useTools) that the active
// connector has changed (URL switch, project switch, reconnect, disconnect,
// or explicit reload).
//
// Living in its own module avoids cross-store circular imports between
// `useOpenCodeStore` and downstream stores that already import it.

export type ConnectorChangeReason =
  | "url"
  | "connect"
  | "disconnect"
  | "project"
  | "reload";

export type ConnectorChangeListener = (reason: ConnectorChangeReason) => void;

const listeners = new Set<ConnectorChangeListener>();

/**
 * Subscribe to connector changes. Returns an unsubscribe function.
 * Listeners are invoked synchronously by `notifyConnectorChange`, so they
 * can capture the still-live OpenCode client from the store before its
 * state is cleared.
 */
export function subscribeToConnectorChange(
  listener: ConnectorChangeListener,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Fire a connector change event. All registered listeners are called
 * synchronously. Errors thrown by individual listeners are swallowed so
 * one misbehaving subscriber cannot break the connector switch flow.
 */
export function notifyConnectorChange(reason: ConnectorChangeReason): void {
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch {
      // Ignore listener errors — the connector switch must complete.
    }
  }
}

/** Test helper — clear all listeners between tests. */
export function _resetConnectorBusForTests(): void {
  listeners.clear();
}

