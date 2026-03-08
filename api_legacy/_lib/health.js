import { sendJson } from "./_lib/http";

export default async function handler(req, res) {
  sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
}
