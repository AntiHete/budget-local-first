import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ProfileProvider } from "./context/ProfileContext.jsx";
import "./styles/globals.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <ProfileProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ProfileProvider>
    </ThemeProvider>
  </React.StrictMode>
);