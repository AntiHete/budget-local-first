/**
 * @typedef {"i_owe" | "owed_to_me"} DebtDirection
 * @typedef {"active" | "closed" | "overdue"} DebtStatus
 *
 * @typedef {Object} Debt
 * @property {number} id
 * @property {number} profileId
 * @property {DebtDirection} direction
 * @property {string} counterparty
 * @property {number} principal
 * @property {string} currency      // "UAH"
 * @property {string} startDate     // YYYY-MM-DD
 * @property {string | null} dueDate
 * @property {DebtStatus} status
 * @property {string} createdAt
 *
 * @typedef {Object} DebtPayment
 * @property {number} id
 * @property {number} profileId
 * @property {number} debtId
 * @property {string} date          // YYYY-MM-DD
 * @property {number} amount
 * @property {string | null} note
 * @property {string} createdAt
 */

export {};
