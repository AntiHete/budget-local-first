import React from "react";
import ThemeToggle from "../components/ThemeToggle";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentList from "../components/payments/PaymentList";
import ExportImport from "../components/storage/ExportImport";

export default function SettingsPage() {
  return (
    <>
      <h1>Налаштування</h1>

      <div className="card">
        <h2>Тема</h2>
        <ThemeToggle />
      </div>

      <PaymentForm />
      <PaymentList />

      <ExportImport />
    </>
  );
}
