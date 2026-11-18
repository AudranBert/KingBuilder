const main = document.querySelector("main");
const menu = document.querySelector("#main-menu");
const loader = document.createElement("div");
loader.className = "loading-status";
loader.setAttribute("role", "status");
loader.textContent = "Chargement de la partie…";
document.body.prepend(loader);
document.querySelector("header").inert = true;
main.inert = true;
menu.inert = true;
try {
  const { startGame } = await import("./app.js");
  startGame();
} catch (error) {
  menu.hidden = true;
  main.hidden = false;
  main.replaceChildren();
  const title = document.createElement("h1");
  title.textContent = "Impossible de démarrer le jeu";
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.className = "startup-error";
  message.textContent = error.message;
  const help = document.createElement("p");
  help.textContent =
    "Vérifiez les fichiers de configuration puis rechargez la page. Le guide se trouve dans dist/config/README.md.";
  const retry = document.createElement("button");
  retry.className = "primary";
  retry.textContent = "Recharger";
  retry.addEventListener("click", () => location.reload());
  main.append(title, message, help, retry);
} finally {
  loader.remove();
  document.querySelector("header").inert = false;
  main.inert = false;
  menu.inert = false;
  main.setAttribute("aria-busy", "false");
}
