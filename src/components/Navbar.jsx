import React from "react";
import { NavLink } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import ProfileSelector from "./ProfileSelector";

const linkClass = ({ isActive }) => (isActive ? "navLink navLinkActive" : "navLink");

export default function Navbar() {
  return (
    <header className="header">
      <div className="container headerCol">
        <div className="headerRow">
          <div className="brand">Budget</div>

          <nav className="nav">
            <NavLink to="/" className={linkClass} end>Дашборд</NavLink>
            <NavLink to="/transactions" className={linkClass}>Транзакції</NavLink>
            <NavLink to="/budgets" className={linkClass}>Бюджети</NavLink>
            <NavLink to="/debts" className={linkClass}>Борги</NavLink>
            <NavLink to="/analytics" className={linkClass}>Аналітика</NavLink>
            <NavLink to="/forecast" className={linkClass}>Прогноз</NavLink>
            <NavLink to="/backup" className={linkClass}>Backup</NavLink>
            <NavLink to="/settings" className={linkClass}>Налаштування</NavLink>
          </nav>

          <ThemeToggle />
        </div>

        <ProfileSelector />
      </div>
    </header>
  );
}
