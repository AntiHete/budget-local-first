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
  budgets: "++id, profileId, month, categoryId, limit",
});

db.version(3).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",
  budgets: "++id, profileId, month, categoryId, limit",

  // reminders/payments (в інтерфейсі)
  // dueDate: 'YYYY-MM-DD'
  payments: "++id, profileId, dueDate, title, amount, categoryId, status, createdAt",
});

db.version(4).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",
  budgets: "++id, profileId, month, categoryId, limit",
  payments: "++id, profileId, dueDate, title, amount, categoryId, status, createdAt",

  // Debts
  debts: "++id, profileId, direction, counterparty, principal, currency, startDate, dueDate, status, createdAt",
  debtPayments: "++id, profileId, debtId, date, amount, createdAt",
});

db.version(5).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",
  budgets: "++id, profileId, month, categoryId, limit",
  payments: "++id, profileId, dueDate, title, amount, categoryId, status, createdAt",

  debts: "++id, profileId, direction, counterparty, principal, currency, startDate, dueDate, status, createdAt",

  // transactionId
  debtPayments: "++id, profileId, debtId, transactionId, date, amount, createdAt",
});
 