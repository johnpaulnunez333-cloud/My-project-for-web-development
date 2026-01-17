document.querySelectorAll("input").forEach(input => {
  input.addEventListener("focus", () => {
    input.style.transform = "scale(1.03)";
  });

  input.addEventListener("blur", () => {
    input.style.transform = "scale(1)";
  });
});

const btn = document.getElementById("loginBtn");

btn.addEventListener("mouseenter", () => {
  btn.style.transform = "scale(1.05)";
});

btn.addEventListener("mouseleave", () => {
  btn.style.transform = "scale(1)";
});