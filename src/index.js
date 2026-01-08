const buildUrl = (baseUrl, path) => {
  if (!baseUrl) {
    throw new Error("apiBaseUrl is required.");
  }
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

export const createBillingClient = ({ apiBaseUrl, getAccessToken, fetchImpl = fetch } = {}) => {
  const buildHeaders = () => {
    const headers = { "Content-Type": "application/json" };
    const token = getAccessToken ? getAccessToken() : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  const request = async (path, options = {}) => {
    const response = await fetchImpl(buildUrl(apiBaseUrl, path), {
      ...options,
      headers: {
        ...buildHeaders(),
        ...(options.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error("Billing request failed.");
    }

    return response.json();
  };

  return {
    getBillingStatus: () => request("/system/billing"),
    cancelSubscription: () => request("/system/billing/cancel", { method: "POST" }),
  };
};

export const createBillingStore = ({ fetchStatus }) => {
  if (!fetchStatus) {
    throw new Error("fetchStatus is required.");
  }
  let cached = null;
  let inflight = null;
  const subscribers = new Set();

  const notify = (next) => {
    subscribers.forEach((callback) => callback(next));
  };

  const load = async (force = false) => {
    if (!force && cached) return cached;
    if (!force && inflight) return inflight;
    inflight = fetchStatus()
      .then((payload) => {
        cached = payload;
        notify(cached);
        return cached;
      })
      .catch((error) => {
        notify(cached);
        throw error;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  return {
    getStatus: (options = {}) => load(Boolean(options.force)),
    getCachedStatus: () => cached,
    refresh: () => load(true),
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
};

export const isSubscriptionActive = (subscription) => subscription?.status === "active";
