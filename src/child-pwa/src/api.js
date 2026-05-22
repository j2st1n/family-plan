const API = "/api/v1";

function headers() {
  const token = localStorage.getItem("device_token");
  if (!token) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function bindDevice(code, displayName) {
  const res = await fetch(`${API}/child-devices/bind`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, display_name: displayName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "绑定失败");
  }
  return res.json();
}

export async function fetchToday() {
  const res = await fetch(`${API}/child/today`, { headers: headers() });
  if (!res.ok) {
    localStorage.removeItem("device_token");
    throw new Error("token_expired");
  }
  return res.json();
}

export async function completeTask(taskId, feedback) {
  const res = await fetch(`${API}/child/tasks/${taskId}/complete`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ feedback }),
  });
  if (!res.ok) throw new Error("完成任务失败");
  return res.json();
}

export async function createChildTask(data) {
  const res = await fetch(`${API}/child/tasks`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("创建失败");
  return res.json();
}

export async function scheduleChildTask(taskId, start, end) {
  const res = await fetch(`${API}/child/tasks/${taskId}/schedule`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ scheduled_start: start, scheduled_end: end }),
  });
  if (!res.ok) throw new Error("安排失败");
  return res.json();
}

export async function updateChildTask(taskId, data) {
  const res = await fetch(`${API}/child/tasks/${taskId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("修改失败");
  return res.json();
}

export async function deleteChildTask(taskId) {
  const res = await fetch(`${API}/child/tasks/${taskId}`, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error("删除失败");
}

export async function fetchShop() {
  const res = await fetch(`${API}/child/shop/items`, { headers: headers() });
  if (!res.ok) throw new Error("加载失败");
  return res.json();
}

async function extractError(res, fallback) {
  try {
    const body = await res.json();
    return body.error?.message || body.detail?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function redeemItem(itemId) {
  const res = await fetch(`${API}/child/shop/items/${itemId}/redeem`, { method: "POST", headers: headers() });
  if (!res.ok) throw new Error(await extractError(res, "兑换失败"));
  return res.json();
}

export async function makeWish(title, description) {
  const res = await fetch(`${API}/child/shop/wishes`, { method: "POST", headers: headers(), body: JSON.stringify({ title, description }) });
  if (!res.ok) throw new Error(await extractError(res, "许愿失败"));
  return res.json();
}

export async function editWish(itemId, title, description) {
  const res = await fetch(`${API}/child/shop/wishes/${itemId}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ title, description }) });
  if (!res.ok) throw new Error(await extractError(res, "修改失败"));
  return res.json();
}
