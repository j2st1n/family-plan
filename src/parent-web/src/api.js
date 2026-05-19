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
    } catch {}
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
};

export default api;
