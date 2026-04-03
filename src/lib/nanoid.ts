export function nanoid() {
  // Для фронта достаточно UUID; в браузере он есть в crypto.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

