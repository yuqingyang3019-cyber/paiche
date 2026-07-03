async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function errorMessage(payload, fallback) {
  if (typeof payload.detail === "string") return payload.detail;
  if (payload.detail?.message) return payload.detail.message;
  return fallback;
}

export async function parseDispatchText(text) {
  const response = await fetch("/api/dispatch/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "解析失败，请稍后重试"));
  }
  return payload;
}

export async function generateDispatch(vehicles) {
  const response = await fetch("/api/dispatch/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vehicles }),
  });
  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(errorMessage(payload, "生成失败，请稍后重试"));
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const filename = match ? decodeURIComponent(match[1]) : "乌达君正.xlsx";
  return { blob: await response.blob(), filename };
}
