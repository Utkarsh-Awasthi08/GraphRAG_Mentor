const API_BASE = "http://localhost:3000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("jwt_token");
  return {
    "Content-Type": "application/json",
    ...(token && { "Authorization": `Bearer ${token}` })
  };
};

export const queryAPI = async (query) => {
  const res = await fetch(`${API_BASE}/query`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error("Failed to fetch from /query");
  return await res.json();
};

export const getHistoryAPI = async () => {
  const res = await fetch(`${API_BASE}/chat/history`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error("Failed to fetch history");
  return await res.json();
};

export const searchHistoryAPI = async (query, page = 1) => {
  const res = await fetch(`${API_BASE}/chat/search?q=${encodeURIComponent(query)}&page=${page}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error("Failed to search history");
  return await res.json();
};

export const explainStreamAPI = async (query, mode, data, onChunk, onDone, onError) => {
  try {
    const res = await fetch(`${API_BASE}/query/explain`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ query, mode, data })
    });

    if (!res.ok) throw new Error("Failed to fetch stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        onChunk(decoder.decode(value, { stream: !done }));
      }
    }
    onDone();
  } catch (err) {
    console.error(err);
    onError(err.message);
  }
};
