(function () {
  try {
    if (localStorage.getItem("discord-theme") === "oled") {
      document.documentElement.classList.add("oled");
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
