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
  payments: "++id, profileId, dueDate, title, amount, categoryId, status, createdAt",
});

db.version(4).stores({
  profiles: "++id, name, createdAt",
  categories: "++id, profileId, type, name",
  transactions: "++id, profileId, date, type, categoryId, amount, createdAt",
  budgets: "++id, profileId, month, categoryId, limit",
  payments: "++id, profileId, dueDate, title, amount, categoryId, status, createdAt",
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
  debtPayments: "++id, profileId, debtId, transactionId, date, amount, createdAt",
});

db.version(6)
  .stores({
    profiles: "++id, name, createdAt",
    categories: "++id, profileId, type, name",
    accounts: "++id, profileId, isDefault, type, name, createdAt",
    transactions: "++id, profileId, accountId, date, type, categoryId, amount, createdAt",
    budgets: "++id, profileId, month, categoryId, limit",
    payments: "++id, profileId, dueDate, title, amount, categoryId, status, createdAt",
    debts: "++id, profileId, direction, counterparty, principal, currency, startDate, dueDate, status, createdAt",
    debtPayments: "++id, profileId, debtId, transactionId, date, amount, createdAt",
  })
  .upgrade(async (tx) => {
    const profilesTable = tx.table("profiles");
    const accountsTable = tx.table("accounts");
    const transactionsTable = tx.table("transactions");

    const profiles = await profilesTable.toArray();

    for (const profile of profiles) {
      let accounts = await accountsTable.where("profileId").equals(profile.id).toArray();

      let defaultAccount = accounts.find((a) => a.isDefault);
      if (!defaultAccount) {
        const now = new Date().toISOString();
        const id = await accountsTable.add({
          profileId: profile.id,
          name: "Основний рахунок",
          type: "cash",
          currency: "UAH",
          openingBalance: 0,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        });

        defaultAccount = {
          id,
          profileId: profile.id,
          name: "Основний рахунок",
          type: "cash",
          currency: "UAH",
          openingBalance: 0,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        };

        accounts = [...accounts, defaultAccount];
      }

      const items = await transactionsTable.where("profileId").equals(profile.id).toArray();
      for (const item of items) {
        if (item.accountId == null) {
          await transactionsTable.update(item.id, {
            accountId: defaultAccount.id,
          });
        }
      }
    }
  });