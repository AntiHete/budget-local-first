import React, { useEffect, useState } from "react";

import ThemeToggle from "../components/ThemeToggle";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentList from "../components/payments/PaymentList";
import ExportImport from "../components/storage/ExportImport";
import { getMe, updateMe, changePassword } from "../api/account";
import { setToken } from "../lib/authToken";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const data = await getMe();
        if (!mounted) return;

        setProfileForm({
          name: data?.user?.name ?? "",
          email: data?.user?.email ?? "",
        });
      } catch (e) {
        if (!mounted) return;
        setError(String(e?.message ?? e));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSaveProfile(e) {
    e.preventDefault();
    setWorking(true);
    setError("");
    setSuccess("");

    try {
      const data = await updateMe({
        name: profileForm.name,
        email: profileForm.email,
      });

      if (data?.token) {
        setToken(data.token);
      }

      setSuccess("Профіль оновлено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setWorking(true);
    setError("");
    setSuccess("");

    try {
      await changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword,
        passwordForm.confirmPassword
      );

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setSuccess("Пароль змінено");
    } catch (e) {
      setError(String(e?.message ?? e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="card">
        <h1>Налаштування</h1>
        <p>
          Тут можна змінити тему, відредагувати дані акаунта, змінити пароль,
          керувати нагадуваннями та зробити резервну копію.
        </p>
      </section>

      <section className="card">
        <h2>Тема</h2>
        <ThemeToggle />
      </section>

      <section className="card">
        <h2>Профіль користувача</h2>

        {loading ? <div className="mutedText">Завантаження...</div> : null}

        <form onSubmit={onSaveProfile} className="formGrid twoCols">
          <label className="field">
            <span>Ім’я</span>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={loading || working}
              placeholder="Ваше ім’я"
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) =>
                setProfileForm((prev) => ({ ...prev, email: e.target.value }))
              }
              disabled={loading || working}
              placeholder="you@example.com"
            />
          </label>

          <div className="fieldActions">
            <button type="submit" disabled={loading || working}>
              Зберегти профіль
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2>Зміна пароля</h2>

        <form onSubmit={onChangePassword} className="formGrid twoCols">
          <label className="field">
            <span>Поточний пароль</span>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  currentPassword: e.target.value,
                }))
              }
              disabled={working}
            />
          </label>

          <label className="field">
            <span>Новий пароль</span>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  newPassword: e.target.value,
                }))
              }
              disabled={working}
              placeholder="Мінімум 6 символів"
            />
          </label>

          <label className="field">
            <span>Підтвердження нового пароля</span>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
              disabled={working}
            />
          </label>

          <div className="fieldActions">
            <button type="submit" disabled={working}>
              Змінити пароль
            </button>
          </div>
        </form>
      </section>

      {(error || success) && (
        <section className="card">
          {error ? <div className="inlineError">{error}</div> : null}
          {success ? <div style={{ color: "#7dffbf" }}>{success}</div> : null}
        </section>
      )}

      <section className="card">
        <h2>Додати платіж (нагадування)</h2>
        <PaymentForm />
      </section>

      <section className="card">
        <h2>Платежі</h2>
        <PaymentList />
      </section>

      <section className="card">
        <h2>Резервна копія (JSON)</h2>
        <ExportImport />
      </section>
    </div>
  );
}
