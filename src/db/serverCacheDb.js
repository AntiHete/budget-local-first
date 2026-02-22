import Dexie from "dexie";

export const serverCacheDb = new Dexie("blf_server_cache");

serverCacheDb.version(1).stores({
  // occurredAt / createdAt / updatedAt зберігаємо як ISO string
  // deletedAt: ISO або null
  // syncStatus: 'synced' | 'created' | 'updated' | 'deleted'
  transactions: "id, profileId, occurredAt, updatedAt, syncStatus, [profileId+occurredAt]",
});