/**
 * @typedef {"planned" | "done"} PaymentStatus
 *
 * @typedef {Object} Payment
 * @property {number} id
 * @property {number} profileId
 * @property {string} dueDate         // YYYY-MM-DD
 * @property {string} title
 * @property {number} amount
 * @property {number | null} categoryId
 * @property {PaymentStatus} status
 * @property {string} createdAt       // ISO
 */

export {};
