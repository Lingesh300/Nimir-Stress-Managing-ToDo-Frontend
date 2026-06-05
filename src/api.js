const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8080";

const getToken = () => localStorage.getItem("token");

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

// AUTH
export const registerUser = (email, password) =>
  fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const loginUser = (email, password) =>
  fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });


export const fetchTodos = () =>
  fetch(`${BASE_URL}/api/v1/todo`, {
    headers: authHeaders(),
  });

export const createTodo = (todo) =>
  fetch(`${BASE_URL}/api/v1/todo/create`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(todo),
  });

export const updateTodo = (todo) =>
  fetch(`${BASE_URL}/api/v1/todo`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(todo),
  });

export const deleteTodo = (id) =>
  fetch(`${BASE_URL}/api/v1/todo/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  export const connectTelegram = (chatId) =>
  fetch(`${BASE_URL}/api/v1/telegram/connect`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ chatId }),
  });

export const getTelegramStatus = () =>
  fetch(`${BASE_URL}/api/v1/telegram/status`, {
    headers: authHeaders(),
  });


export const generateTelegramCode = () =>
  fetch(`${BASE_URL}/api/v1/telegram/generate-code`, {
    method: "POST",
    headers: authHeaders(),
  });

