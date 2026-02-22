import Dexie from "dexie";

export const serverCacheDb = new Dexie("blf_server_cache");

// v1 було тільки transactions
serverCacheDb.version(1).stores({
  transactions: "id, profileId, occurredAt, updatedAt, syncStatus, [profileId+occurredAt]",
});

// v2 додаємо budgets, debts, debtPayments
serverCacheDb.version(2).stores({
  transactions: "id, profileId, occurredAt, updatedAt, syncStatus, [profileId+occurredAt]",

  // key = `${month}::${category}` щоб не мати проблем з upsert (серверний id зберігаємо окремо)
  budgets: "key, profileId, month, category, serverId, updatedAt, [profileId+month], [profileId+category]",

  debts: "id, profileId, status, startedAt, updatedAt, [profileId+status], [profileId+startedAt]",

  debtPayments: "id, profileId, debtId, occurredAt, [debtId+occurredAt]",
});