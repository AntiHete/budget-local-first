import { pushPendingTransactions, pullTransactionsToCache } from "./transactionsSync";
import { pushPendingBudgets, pullBudgetsToCache } from "./budgetsSync";
import { pushPendingDebts, pullDebtsToCache } from "./debtsSync";
import { pushPendingDebtPayments } from "./debtPaymentsSync";

export async function fullSync() {
  // push order: debts -> payments (payments залежать від debts)
  await pushPendingTransactions();
  await pushPendingBudgets();
  await pushPendingDebts();
  await pushPendingDebtPayments();

  // pull
  await pullTransactionsToCache({ limit: 200 });
  await pullBudgetsToCache();
  await pullDebtsToCache({ limit: 200 });
}