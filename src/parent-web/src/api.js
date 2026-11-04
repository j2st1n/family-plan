const API = "/api/v1";

const h = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

async function request(url, opts = {}) {
  const res = await fetch(`${API}${url}`, opts);
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error?.message || body.detail?.message || msg;
    } catch (error) {
      console.warn("Failed to parse error response", error);
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  login(username, password) {
    return request("/auth/login", {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ username, password }),
    });
  },

  register(username, password) {
    return request("/auth/register", {
      method: "POST",
      headers: h(),
      body: JSON.stringify({ username, password }),
    });
  },

  fetchChildren(token) {
    return request("/children", { headers: h(token) });
  },

  createChild(token, name, grade) {
    return request("/children", {
      method: "POST",
      headers: h(token),
      body: JSON.stringify({ name, grade_label: grade }),
    });
  },

  fetchDashboard(token, childId) {
    return request(`/children/${childId}/dashboard`, { headers: h(token) });
  },

  fetchRewardSettings(token, childId) {
    return request(`/children/${childId}/reward-settings`, { headers: h(token) });
  },

  updateRewardSettings(token, childId, data) {
    return request(`/children/${childId}/reward-settings`, {
      method: "PATCH",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  fetchPlans(token, childId) {
    const q = childId ? `?child_id=${childId}` : "";
    return request(`/plans${q}`, { headers: h(token) });
  },

  createPlan(token, body) {
    return request("/plans", {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(body),
    });
  },

  getPlan(token, planId) {
    return request(`/plans/${planId}`, { headers: h(token) });
  },

  getAccessCode(token, childId) {
    return request(`/children/${childId}/access-code`, {
      method: "POST",
      headers: h(token),
    });
  },

  createManualTasks(token, planId, taskDate, tasks) {
    return request(`/plans/${planId}/daily-tasks`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify({ task_date: taskDate, tasks }),
    });
  },

  fetchDailyTasks(token, planId, taskDate) {
    return request(`/plans/${planId}/daily-tasks?task_date=${taskDate}`, {
      headers: h(token),
    });
  },

  addRoutineTask(token, planId, data) {
    return request(`/plans/${planId}/task-templates`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  updateChild(token, childId, data) {
    return request(`/children/${childId}`, {
      method: "PATCH",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  deleteChild(token, childId) {
    return request(`/children/${childId}`, { method: "DELETE", headers: h(token) });
  },

  updateDailyTask(token, planId, taskId, data) {
    return request(`/plans/${planId}/daily-tasks/${taskId}`, {
      method: "PATCH",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  deleteDailyTask(token, planId, taskId) {
    return request(`/plans/${planId}/daily-tasks/${taskId}`, { method: "DELETE", headers: h(token) });
  },

  approveTask(token, taskId) {
    return request(`/plans/tasks/${taskId}/approve`, { method: "POST", headers: h(token) });
  },

  checkTask(token, taskId) {
    return request(`/plans/tasks/${taskId}/check`, { method: "POST", headers: h(token) });
  },

  rejectTask(token, taskId) {
    return request(`/plans/tasks/${taskId}/reject`, { method: "POST", headers: h(token) });
  },

  revokeTask(token, taskId) {
    return request(`/plans/tasks/${taskId}/revoke`, { method: "POST", headers: h(token) });
  },

  updateRoutineTask(token, planId, templateId, data) {
    return request(`/plans/${planId}/task-templates/${templateId}`, {
      method: "PATCH",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  deleteRoutineTask(token, planId, templateId) {
    return request(`/plans/${planId}/task-templates/${templateId}`, { method: "DELETE", headers: h(token) });
  },

  fetchShop(token) {
    return request("/shop/items", { headers: h(token) });
  },

  createShopItem(token, data) {
    return request("/shop/items", { method: "POST", headers: h(token), body: JSON.stringify(data) });
  },

  updateShopItem(token, itemId, data) {
    return request(`/shop/items/${itemId}`, { method: "PATCH", headers: h(token), body: JSON.stringify(data) });
  },

  deleteShopItem(token, itemId) {
    return request(`/shop/items/${itemId}`, { method: "DELETE", headers: h(token) });
  },

  approveWish(token, itemId, starCost) {
    return request(`/shop/items/${itemId}/approve`, { method: "PATCH", headers: h(token), body: JSON.stringify({ star_cost: starCost }) });
  },

  fetchRedemptions(token) {
    return request("/shop/redemptions", { headers: h(token) });
  },

  fulfillItem(token, redemptionId) {
    return request(`/shop/redemptions/${redemptionId}/fulfill`, { method: "PATCH", headers: h(token) });
  },

  fetchAnalytics(token, childId, days = 30) {
    return request(`/plans/children/${childId}/analytics?days=${days}`, { headers: h(token) });
  },

  fetchVacations(token, childId) {
    return request(`/plans/children/${childId}/vacations`, { headers: h(token) });
  },

  createVacation(token, childId, data) {
    return request(`/plans/children/${childId}/vacations`, {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  deleteVacation(token, childId, vacationId) {
    return request(`/plans/children/${childId}/vacations/${vacationId}`, {
      method: "DELETE",
      headers: h(token),
    });
  },

  fetchChildFreeze(token, childId) {
    return request(`/shop/children/${childId}/freeze`, { headers: h(token) });
  },

  adjustChildFreeze(token, childId, delta, reason = "") {
    return request(`/shop/children/${childId}/freeze/adjust`, {
      method: "PATCH",
      headers: h(token),
      body: JSON.stringify({ delta, reason }),
    });
  },

  updateFreezeSettings(token, childId, data) {
    return request(`/shop/children/${childId}/freeze/settings`, {
      method: "PUT",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  parseCopilotTasks(token, data) {
    return request("/ai/copilot/parse-tasks", {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  fetchAiHealth(token) {
    return request("/ai/health", { headers: h(token) });
  },

  fetchAiSettings(token) {
    return request("/ai/settings", { headers: h(token) });
  },

  updateAiSettings(token, data) {
    return request("/ai/settings", {
      method: "PUT",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  testAiConnection(token, data) {
    return request("/ai/test-connection", {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },

  fetchAiModels(token, data) {
    return request("/ai/fetch-models", {
      method: "POST",
      headers: h(token),
      body: JSON.stringify(data),
    });
  },
};

export default api;
