const socket = io();
const $ = (s) => document.querySelector(s);

// Audio
const bgm = $("#bgm");
let audioActivated = false;

// Header
const usernameInput = $("#username");
const enterBtn = $("#enterBtn");
const msg = $("#message");

// Sparkle button
const collectBtn = $("#collectBtn");

// Right panel
const gallery = $("#gallery");

//left panel
const leaderboard = $("#leaderboard");
// Found artifact fragment
const foundCard = $("#foundCard");
const artifactSlice = $("#artifactSlice");
const artifactName = $("#artifactName");
const artifactBlurb = $("#artifactBlurb");

// Sparkle button position animation
const collectContainer = $("#collectContainer");
let animationInterval = 2500; // variable to set how quickly the sparkle moves
let intervalId;
let isAnimating = true;

// Completed animation
let animationDuration = 1500; // variable to set the duration of the overlay

//Checks if server is full
socket.on('server-full', (data) => {
  msg.textContent = data.message;
  alert(data.message); // Show an alert if server is full 
  enterBtn.disabled = true;
  collectBtn.disabled = true;
});

// ------------------------ Sparkle button animation -------------------------------

//function to get a random position inside a div container 
function getRandomPosition() {
  // Dimensions
  const containerWidth = collectContainer.offsetWidth;
  const containerHeight = collectContainer.offsetHeight;
  const btnWidth = collectBtn.offsetWidth;
  const btnHeight = collectBtn.offsetHeight;

  // Calculate max positions to keep button inside container
  const maxX = containerWidth - btnWidth;
  const maxY = containerHeight - btnHeight;

  const randomX = Math.random() * maxX;
  const randomY = Math.random() * maxY;

  return { x: randomX, y: randomY };
}

function animateButton() {
  collectBtn.style.animation = 'none';
  collectBtn.offsetHeight;
  collectBtn.style.animation = `blinking ${animationInterval}ms ease-in-out`;
  const pos = getRandomPosition();
  collectBtn.style.left = pos.x + 'px';
  collectBtn.style.top = pos.y + 'px';
}

function startAnimation() {
  // Initial position
  const pos = getRandomPosition();
  collectBtn.style.left = pos.x + 'px';
  collectBtn.style.top = pos.y + 'px';

  intervalId = setInterval(animateButton, animationInterval);
}

function updateInterval() {
  const newInterval = parseInt(document.getElementById('intervalInput').value);
  if (newInterval >= 500) {
    animationInterval = newInterval;
    if (isAnimating) {
      clearInterval(intervalId);
      startAnimation();
    }
  }
}

function toggleAnimation() {
  if (isAnimating) {
    clearInterval(intervalId);
    collectBtn.style.animation = 'none';
    isAnimating = false;
  } else {
    startAnimation();
    isAnimating = true;
  }
}

//doesnt star the animation until the container is loaded 
document.addEventListener('DOMContentLoaded', function () {
  container = document.getElementById('collectContainer');
  startAnimation();
});

// ---------------------- Artifact completion animation -------------------------
function showCompletionAnimation(artifactKey) {
  
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "completion-overlay";
  overlay.innerHTML = `
    <div class="completion-content ${artifactKey}">
      <div class="completion-image"></div>
      <h2>Artifact Complete!</h2>
    </div>
  `;
  document.body.appendChild(overlay);

  // Play completion sound
  const completionSound = new Audio("sounds/completion.mp3");
  completionSound.play().catch(() => { });

  // Remove after animation
  setTimeout(() => {
    overlay.classList.add("fade-out");
    setTimeout(() => overlay.remove(), 500);
  }, animationDuration);
}

// ----------------------- background audio activation -------------------------
function activateAudioOnce() {
  if (!audioActivated) {
    audioActivated = true;
    bgm.muted = false;
    bgm.play().catch(() => { });
  }
}

// ------------------------------ Register player ------------------------------
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
    msg.textContent = ret && ret.ok ? "Ready to collect? Click on the sparkle to uncover hidden treasures!" : "Registration failed.";
  });
});

// ------------------------ Player collects a fragment -----------------------------
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

      // Without this the first time you find something it shows an empty div for the fragment info
      if (!data.fragment) {
        msg.textContent = data.message;
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

      // Play sound
      const pieceSound = document.getElementById("pieceSound");
      if (pieceSound) {
        pieceSound.currentTime = 0;
        pieceSound.play().catch(() => { });
      }

      // Check if artifact is completed
      if (data.completed) {
        showCompletionAnimation(data.artifactKey);
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

// ----------------------- Render leaderboard ------------------------------
function renderLeaderboard(players) {
  leaderboard.innerHTML = "";
  players.slice().sort((a, b) => b.score - a.score).forEach(p => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${p.name}</span><span>${p.score} pts</span>`;
    leaderboard.appendChild(li);
  });
}

// ------------------------ Render gallery ---------------------------------
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

// ------------------------------- Initial load -----------------------------
fetch("/data")
  .then(res => res.json())
  .then(data => {
    renderLeaderboard(data.players);
    renderGallery(data.fragments);
  });

document.addEventListener("click", activateAudioOnce, { once: true });
document.addEventListener("keydown", activateAudioOnce, { once: true });
