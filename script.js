window.addEventListener("DOMContentLoaded", (event) => {
  const adminBtn = document.getElementById("admin-btn");
  const playerBtn = document.getElementById("player-btn");

  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      console.log("Admin button clicked");
      window.location.href = "admin.html";
    });
  }

  if (playerBtn) {
    playerBtn.addEventListener("click", () => {
      console.log("Player button clicked");
      window.location.href = "student.html";
    });
  }
});
