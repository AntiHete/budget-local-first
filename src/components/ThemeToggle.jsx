import React from "react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button className="btn" onClick={toggleTheme} type="button" title="Перемкнути тему">
      Тема: {theme === "dark" ? "Темна" : "Світла"}
    </button>
  );
}
