// main.js — Full logic for player, gallery, and fragment display
const socket = io();
const $ = (s) => document.querySelector(s);

socket.on('server-full', (data) => {
  msg.textContent = data.message;
  alert(data.message); // Show an alert so users definitely see it
});

const bgm = $("#bgm");
const usernameInput = $("#username");
const enterBtn = $("#enterBtn");
const collectBtn = $("#collectBtn");
const msg = $("#message");
const leaderboard = $("#leaderboard");
const gallery = $("#gallery");

const foundCard = $("#foundCard");
const artifactSlice = $("#artifactSlice");
const artifactName = $("#artifactName");
const artifactBlurb = $("#artifactBlurb");

let audioActivated = false;
function activateAudioOnce() {
  if (!audioActivated) {
    audioActivated = true;
    bgm.muted = false;
    bgm.play().catch(() => {});
  }
}

function registerPlayer(name) {
  return fetch("/new-player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  }).then(res => res.json());
}

enterBtn.addEventListener("click", function () {
  const name = (usernameInput.value || "").trim();
  if (!name) { msg.textContent = "Please enter your name."; return; }
  activateAudioOnce();
  registerPlayer(name).then(ret => {
    msg.textContent = ret && ret.ok ? "Ready to collect?" : "Registration failed.";
  });
});

// ---- Player collects a fragment ----
collectBtn.addEventListener("click", function () {
  const name = (usernameInput.value || "").trim();
  if (!name) { msg.textContent = "Please enter your name first."; return; }
  activateAudioOnce();

  fetch("/dive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: name })
  })
    .then(res => res.json())
    .then(data => {
      if (!data || !data.ok) {
        msg.textContent = data.message || "Error.";
        return;
      }

      const frag = data.fragment;
      msg.textContent = data.message;

      // --- Show fragment on left card ---
      foundCard.classList.remove("hidden");
      artifactName.textContent = frag.artifactName;
      artifactBlurb.textContent = frag.blurb;
      artifactSlice.style.backgroundImage = `url('${frag.image}')`;
      artifactSlice.className = "slice q" + frag.quadrant;

      const pieceSound = document.getElementById("pieceSound");
if (pieceSound) {
  pieceSound.currentTime = 0; 
  pieceSound.play().catch(() => {});
}

      // --- Update leaderboard and gallery ---
      if (Array.isArray(data.leaderboard)) renderLeaderboard(data.leaderboard);
      fetch("/data").then(r => r.json()).then(db => renderGallery(db.fragments));
    })
    .catch(() => msg.textContent = "Network error.");
});

socket.on("leaderboard-update", renderLeaderboard);
socket.on("fragment-found", function () {
  fetch("/data").then(r => r.json()).then(db => renderGallery(db.fragments));
});

// ---- Render leaderboard ----
function renderLeaderboard(players) {
  leaderboard.innerHTML = "";
  players.slice().sort((a, b) => b.score - a.score).forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${p.name}</span><span>${p.score} pts</span>`;
    leaderboard.appendChild(li);
  });
}

// ---- Render gallery ----
function renderGallery(fragments) {
  if (!Array.isArray(fragments)) return;
  gallery.innerHTML = "";

  const grouped = {};
  fragments.forEach(f => {
    if (!grouped[f.artifactKey]) grouped[f.artifactKey] = [];
    grouped[f.artifactKey].push(f);
  });

  Object.keys(grouped).forEach(key => {
    const fragList = grouped[key];
    const thumb = document.createElement("div");
    thumb.className = "artifact-thumb";
    fragList.forEach(f => {
      const piece = document.createElement("div");
      piece.className = "thumb-slice q" + f.quadrant;
      piece.style.backgroundImage = `url('${f.image}')`;
      if (f.foundBy) piece.classList.add("found");
      thumb.appendChild(piece);
    });
    gallery.appendChild(thumb);
  });
}

// ---- Initial load ----
fetch("/data")
  .then(res => res.json())
  .then(data => {
    renderLeaderboard(data.players);
    renderGallery(data.fragments);
  });


document.addEventListener("click", activateAudioOnce, { once: true });
document.addEventListener("keydown", activateAudioOnce, { once: true });
