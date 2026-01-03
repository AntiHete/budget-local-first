import React from "react";
import CategoryManager from "../components/categories/CategoryManager";
import TransactionForm from "../components/transactions/TransactionForm";
import TransactionList from "../components/transactions/TransactionList";

export default function TransactionsPage() {
  return (
    <>
      <h1>Транзакції</h1>
      <CategoryManager />
      <TransactionForm />
      <TransactionList />
    </>
  );
}
