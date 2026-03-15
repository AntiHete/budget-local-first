import React from "react";
import Navbar from "./Navbar";

export default function AppShell({ children }) {
  return (
    <div className="appRoot">
      <Navbar />

      <main className="pageMain">
        <div className="pageContainer">{children}</div>
      </main>

      <footer className="appFooter">
        <div className="pageContainer">
          <span>
            Budget — локально-перша система керування фінансами з серверною синхронізацією транзакцій
          </span>
        </div>
      </footer>
    </div>
  );
}
