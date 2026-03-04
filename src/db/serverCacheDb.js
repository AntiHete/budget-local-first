import Dexie from "dexie";

export const serverCacheDb = new Dexie("blf_server_cache");

serverCacheDb.version(1).stores({
  transactions: "id, profileId, occurredAt, updatedAt, syncStatus, [profileId+occurredAt]",
});

serverCacheDb.version(2).stores({
  transactions: "id, profileId, occurredAt, updatedAt, syncStatus, [profileId+occurredAt]",
  budgets: "key, profileId, month, category, serverId, updatedAt, [profileId+month], [profileId+category]",
  debts: "id, profileId, status, startedAt, updatedAt, [profileId+status], [profileId+startedAt]",
  debtPayments: "id, profileId, debtId, occurredAt, [debtId+occurredAt]",
});

// v3: local-first (pending queue)
serverCacheDb.version(3).stores({
  transactions: "id, profileId, occurredAt, updatedAt, syncStatus, deletedAt, [profileId+occurredAt]",

  budgets:
    "key, profileId, month, category, serverId, updatedAt, syncStatus, deletedAt, [profileId+month], [profileId+category]",

  debts:
    "id, profileId, status, startedAt, updatedAt, syncStatus, deletedAt, [profileId+status], [profileId+startedAt]",

  debtPayments:
    "id, profileId, debtId, occurredAt, updatedAt, syncStatus, deletedAt, [debtId+occurredAt]",
});