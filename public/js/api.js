// /public/js/api.js
(function () {
  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {})
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`HTTP ${r.status}: ${t || "Request failed"}`);
    }
    return r.json();
  }

  async function searchProducts(query, hitsPerPage = 5) {
    return postJSON("/api/search", { query, hitsPerPage });
  }

  async function submitQuote(formData) {
    return postJSON("/api/quote", formData);
  }

  async function registerUser({ name, email, password }) {
    return postJSON("/api/users/register", { name, email, password });
  }

  async function loginUser({ email, password }) {
    return postJSON("/api/users/login", { email, password });
  }

  window.API = {
    postJSON,
    searchProducts,
    submitQuote,
    registerUser,
    loginUser,
  };
})();
