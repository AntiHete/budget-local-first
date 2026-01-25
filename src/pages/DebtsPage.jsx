import React, { useState } from "react";
import DebtForm from "../components/debts/DebtForm";
import DebtList from "../components/debts/DebtList";
import DebtDetails from "../components/debts/DebtDetails";

export default function DebtsPage() {
  const [openDebtId, setOpenDebtId] = useState(null);

  return (
    <>
      <h1>Борги</h1>

      <DebtForm />

      <DebtList onOpen={(id) => setOpenDebtId(id)} />

      {openDebtId && (
        <DebtDetails
          debtId={openDebtId}
          onClose={() => setOpenDebtId(null)}
        />
      )}
    </>
  );
}
