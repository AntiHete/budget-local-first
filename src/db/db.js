import Dexie from "dexie";

export const db = new Dexie("BudgetLocalFirstDB");

db.version(1).stores({
  profiles: "++id, name, createdAt",

  // type: "expense" | "income"
  categories: "++id, profileId, type, name",

  // date: ISO string (YYYY-MM-DD)
  // amount: number
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",
});
