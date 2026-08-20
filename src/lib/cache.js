const store = {};

export function getCache(key) {
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    delete store[key];
    return null;
  }
  return entry.data;
}

export function setCache(key, data, ttlMs = 120000) {
  store[key] = {
    data,
    expiry: Date.now() + ttlMs,
  };
}

export function clearCache(key) {
  if (key) {
    delete store[key];
  } else {
    Object.keys(store).forEach((k) => delete store[k]);
  }
}