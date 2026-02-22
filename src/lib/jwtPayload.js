export function parseJwtPayload(token) {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = parts[1];
    const json = decodeBase64Url(payload);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function decodeBase64Url(input) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  const bin = atob(padded);
  let out = "";
  for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i));

  // decode UTF-8
  return decodeURIComponent(
    Array.prototype.map
      .call(out, (c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
}