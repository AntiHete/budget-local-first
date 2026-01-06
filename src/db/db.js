import Dexie from "dexie";

export const db = new Dexie("BudgetLocalFirstDB");

db.version(1).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",
});

db.version(2).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",

  // month: 'YYYY-MM'
  budgets: "++id, profileId, month, categoryId, limit",
});
