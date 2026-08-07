export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type FamilySyncPayload = {
  familyId: string;
  eventType: string;
  updatedAt: string;
};

export type FamilySyncRefetchPlan = {
  tasks?: boolean;
  families?: boolean;
  members?: boolean;
  profile?: boolean;
  resolveActiveFamily?: boolean;
};
