import Dexie from "dexie";

export const db = new Dexie("BudgetLocalFirstDB");

db.version(1).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount",
});
