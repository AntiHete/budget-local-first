import React from "react";
import Navbar from "./Navbar";

export default function AppShell({ children }) {
  return (
    <div className="app">
      <Navbar />
      <main className="container main">{children}</main>
      <footer className="footer">
        <div className="container">Local-first • дані зберігаються в браузері</div>
      </footer>
    </div>
  );
}
