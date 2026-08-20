"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { FamilySyncPayload, RealtimeConnectionState } from "./types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

type ConnectionListener = (state: RealtimeConnectionState) => void;

let echoInstance: Echo<"pusher"> | null = null;
let echoInitPromise: Promise<Echo<"pusher"> | null> | null = null;
let subscribedFamilyId: string | null = null;
let subscribedChannel: ReturnType<Echo<"pusher">["private"]> | null = null;
const connectionListeners = new Set<ConnectionListener>();
let connectionState: RealtimeConnectionState = "idle";

declare global {
  interface Window {
    Pusher?: typeof Pusher;
    __familyTaskEcho?: Echo<"pusher">;
  }
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

export function isReverbConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_REVERB_APP_KEY &&
      process.env.NEXT_PUBLIC_REVERB_HOST &&
      process.env.NEXT_PUBLIC_REVERB_PORT &&
      process.env.NEXT_PUBLIC_REVERB_SCHEME,
  );
}

function setConnectionState(next: RealtimeConnectionState): void {
  if (connectionState === next) {
    return;
  }

  connectionState = next;

  if (process.env.NODE_ENV === "development") {
    console.debug("[realtime] connection:", next);
  }

  for (const listener of connectionListeners) {
    listener(next);
  }
}

export function getRealtimeConnectionState(): RealtimeConnectionState {
  return connectionState;
}

export function subscribeRealtimeConnectionState(
  listener: ConnectionListener,
): () => void {
  connectionListeners.add(listener);
  listener(connectionState);

  return () => {
    connectionListeners.delete(listener);
  };
}

function bindConnectionEvents(echo: Echo<"pusher">): void {
  const connection = echo.connector.pusher.connection;

  connection.bind("connecting", () => setConnectionState("connecting"));
  connection.bind("connected", () => setConnectionState("connected"));
  connection.bind("disconnected", () => setConnectionState("disconnected"));
  connection.bind("error", () => setConnectionState("error"));
  connection.bind("unavailable", () => setConnectionState("error"));
}

async function createEchoInstance(): Promise<Echo<"pusher"> | null> {
  if (typeof window === "undefined" || !isReverbConfigured()) {
    return null;
  }

  if (echoInstance) {
    return echoInstance;
  }

  if (window.__familyTaskEcho) {
    echoInstance = window.__familyTaskEcho;
    return echoInstance;
  }

  window.Pusher = Pusher;

  const scheme = process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http";
  const port = Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? "8087");
  const forceTLS = scheme === "https";

  echoInstance = new Echo({
    broadcaster: "pusher",
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: forceTLS ? ["wss"] : ["ws"],
    disableStats: true,
    cluster: "mt1",
    authEndpoint: `${getApiBaseUrl()}/api/broadcasting/auth`,
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        void (async () => {
          try {
            const user = getFirebaseAuth().currentUser;
            if (!user) {
              callback(new Error("認証が必要です"), null);
              return;
            }

            const token = await user.getIdToken();
            const body = new URLSearchParams({
              socket_id: socketId,
              channel_name: channel.name,
            });

            const response = await fetch(`${getApiBaseUrl()}/api/broadcasting/auth`, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Bearer ${token}`,
              },
              body,
            });

            if (!response.ok) {
              callback(new Error(`Broadcast auth failed (${response.status})`), null);
              return;
            }

            const data = (await response.json()) as { auth: string; channel_data?: string };
            callback(null, data);
          } catch (error) {
            callback(
              error instanceof Error ? error : new Error("Broadcast auth failed"),
              null,
            );
          }
        })();
      },
    }),
  });

  window.__familyTaskEcho = echoInstance;
  bindConnectionEvents(echoInstance);
  setConnectionState("connecting");

  return echoInstance;
}

export async function ensureEchoConnected(): Promise<Echo<"pusher"> | null> {
  if (!isReverbConfigured()) {
    return null;
  }

  if (echoInstance) {
    return echoInstance;
  }

  if (!echoInitPromise) {
    echoInitPromise = createEchoInstance().finally(() => {
      echoInitPromise = null;
    });
  }

  return echoInitPromise;
}

export function getEchoSocketId(): string | null {
  const socketId = echoInstance?.socketId();

  return typeof socketId === "string" && socketId.length > 0 ? socketId : null;
}

function leaveCurrentFamilyChannel(): void {
  if (!echoInstance || !subscribedFamilyId) {
    subscribedChannel = null;
    subscribedFamilyId = null;
    return;
  }

  echoInstance.leave(`family.${subscribedFamilyId}`);
  subscribedChannel = null;
  subscribedFamilyId = null;
}

export function subscribeFamilySyncChannel(
  familyId: string,
  onEvent: (payload: FamilySyncPayload) => void,
): () => void {
  let cancelled = false;
  let cleanup: (() => void) | null = null;

  void ensureEchoConnected().then((echo) => {
    if (cancelled || !echo) {
      return;
    }

    if (subscribedFamilyId === familyId && subscribedChannel) {
      subscribedChannel.stopListening(".family.sync");
      subscribedChannel.listen(".family.sync", onEvent);
      cleanup = () => {
        if (subscribedFamilyId === familyId) {
          leaveCurrentFamilyChannel();
        }
      };
      return;
    }

    leaveCurrentFamilyChannel();

    const channel = echo.private(`family.${familyId}`);
    channel.listen(".family.sync", onEvent);

    subscribedFamilyId = familyId;
    subscribedChannel = channel;

    cleanup = () => {
      if (subscribedFamilyId === familyId) {
        leaveCurrentFamilyChannel();
      }
    };
  });

  return () => {
    cancelled = true;
    cleanup?.();
  };
}

export function disconnectEcho(): void {
  leaveCurrentFamilyChannel();

  if (echoInstance) {
    echoInstance.disconnect();
  }

  echoInstance = null;
  echoInitPromise = null;

  if (typeof window !== "undefined") {
    delete window.__familyTaskEcho;
  }

  setConnectionState("disconnected");
}
