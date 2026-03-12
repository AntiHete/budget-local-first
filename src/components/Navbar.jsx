import React from "react";
import { NavLink } from "react-router-dom";

import ThemeToggle from "./ThemeToggle";
import ProfileSelector from "./ProfileSelector";

const linkClass = ({ isActive }) =>
  isActive ? "navLink navLinkActive" : "navLink";

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbarBrand">Budget</div>

      <nav className="navbarLinks">
        <NavLink to="/" className={linkClass}>
          Дашборд
        </NavLink>
        <NavLink to="/transactions" className={linkClass}>
          Транзакції
        </NavLink>
        <NavLink to="/accounts" className={linkClass}>
          Рахунки
        </NavLink>
        <NavLink to="/budgets" className={linkClass}>
          Бюджети
        </NavLink>
        <NavLink to="/debts" className={linkClass}>
          Борги
        </NavLink>
        <NavLink to="/analytics" className={linkClass}>
          Аналітика
        </NavLink>
        <NavLink to="/forecast" className={linkClass}>
          Прогноз
        </NavLink>
        <NavLink to="/backup" className={linkClass}>
          Backup
        </NavLink>
        <NavLink to="/profiles" className={linkClass}>
          Profiles
        </NavLink>
        <NavLink to="/settings" className={linkClass}>
          Налаштування
        </NavLink>
      </nav>

      <div className="navbarRight">
        <ProfileSelector />
        <ThemeToggle />
      </div>
    </header>
  );
}
