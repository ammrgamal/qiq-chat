// /public/js/quote-form.js
(function () {
  const form = document.getElementById("quote-form");
  const status = document.getElementById("quote-status");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "جارٍ الإرسال…";

    const data = Object.fromEntries(new FormData(form).entries());
    data.users = Number(data.users || 0);

    try {
      const res = await API.submitQuote(data);
      if (res.ok) {
        status.textContent = "تم استلام الطلب. سنتواصل معك قريباً.";
        form.reset();
      } else {
        status.textContent = res.error || "تعذّر إرسال الطلب.";
      }
    } catch (err) {
      status.textContent = err.message || "تعذّر إرسال الطلب.";
    }
  });
})();
