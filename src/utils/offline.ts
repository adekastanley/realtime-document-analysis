export function isOffline() {
  if (typeof navigator === "undefined") return true;
  return !navigator.onLine;
}

