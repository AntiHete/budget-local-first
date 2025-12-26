import React from "react";
import ThemeToggle from "../components/ThemeToggle";

export default function SettingsPage() {
  return (
    <>
      <h1>Налаштування</h1>
      <div className="card">
        <h2>Тема</h2>
        <ThemeToggle />
      </div>

      <div className="card">
        <h2>Резервні копії</h2>
        <p>Пізніше додамо експорт/імпорт JSON.</p>
      </div>
    </>
  );
}
