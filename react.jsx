function loginLogic() {
  const btn = document.getElementById("loginBtn");
  const btnText = document.getElementById("btnText");
  const loading = document.getElementById("loading");

  btn.addEventListener("click", () => {
    btnText.classList.add("d-none");
    loading.classList.remove("d-none");

    setTimeout(() => {
      loading.classList.add("d-none");
      btnText.classList.remove("d-none");
      alert("Login finished");
    }, 2000);
  });
}

loginLogic();