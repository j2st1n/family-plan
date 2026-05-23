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

export async function fetchToday(onExpired) {
  const res = await fetch(`${API}/child/today`, { headers: headers() });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("device_token");
      if (onExpired) onExpired();
      throw new Error("token_expired");
    }
    throw new Error("获取今日任务失败");
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

export async function fetchShop(onExpired) {
  const res = await fetch(`${API}/child/shop/items`, { headers: headers() });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("device_token");
      if (onExpired) onExpired();
      throw new Error("token_expired");
    }
    throw new Error("加载失败");
  }
  return res.json();
}

const ERROR_CN = {
  "Out of stock": "库存不足",
  "Not enough stars": "星星不够",
  "Item not found": "商品不存在",
  "Child not found": "用户不存在",
  "Wish not found or not pending": "许愿不存在或已审核",
  "Already fulfilled": "已兑现",
};

async function extractError(res, fallback) {
  try {
    const body = await res.json();
    const msg = body.error?.message || body.detail?.message || fallback;
    return ERROR_CN[msg] || msg;
  } catch {
    return fallback;
  }
}

export async function redeemItem(itemId, onExpired) {
  const res = await fetch(`${API}/child/shop/items/${itemId}/redeem`, { method: "POST", headers: headers() });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("device_token");
      if (onExpired) onExpired();
      throw new Error("token_expired");
    }
    throw new Error(await extractError(res, "兑换失败"));
  }
  return res.json();
}

export async function makeWish(title, description, onExpired) {
  const res = await fetch(`${API}/child/shop/wishes`, { method: "POST", headers: headers(), body: JSON.stringify({ title, description }) });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("device_token");
      if (onExpired) onExpired();
      throw new Error("token_expired");
    }
    throw new Error(await extractError(res, "许愿失败"));
  }
  return res.json();
}

export async function editWish(itemId, title, description, onExpired) {
  const res = await fetch(`${API}/child/shop/wishes/${itemId}`, { method: "PATCH", headers: headers(), body: JSON.stringify({ title, description }) });
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("device_token");
      if (onExpired) onExpired();
      throw new Error("token_expired");
    }
    throw new Error(await extractError(res, "修改失败"));
  }
  return res.json();
}
