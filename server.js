// server.js — Fixed version for Nanhai No.1 Underwater Archaeology Game
// Express + Lowdb v5 + Socket.io

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.json());
app.use("/", express.static(path.join(__dirname, "public")));

// variables to limit the amount of users on the server
const MAX_USERS = 4; //max amount of users
let activeUsers = 0; //active users 

// ------------------ Database ------------------
const adapter = new JSONFile(path.join(__dirname, "db.json"));
const db = new Low(adapter);

const ARTIFACTS = [
  { key: "empty_box", name: "Empty Box", blurb: "An empty chest, yet full of mystery.", points: 0, image: "images/artifacts/empty_box.jpg" },
  { key: "coins", name: "Copper Coins", blurb: "Traces of ancient trade routes engraved in metal.", points: 1, image: "images/artifacts/coins.jpg" },
  { key: "silver_ingot", name: "Stamped Silver Ingot", blurb: "Merchant stamps tell stories of distant cities.", points: 2, image: "images/artifacts/silver_ingot.png" },
  { key: "longquan", name: "Longquan Celadon Plate", blurb: "Delicate glaze that once traveled oceans.", points: 3, image: "images/artifacts/longquan_plate.jpg" },
  { key: "white_ewer", name: "White Glazed Ewer", blurb: "Graceful porcelain made for everyday voyage life.", points: 4, image: "images/artifacts/white_ewer.png" },
  { key: "jade_arhat", name: "Jade Arhat Figurine", blurb: "Tiny sculpture, faith and trade intertwined.", points: 5, image: "images/artifacts/jade_arhat.jpg" },
  { key: "gold_ring", name: "Gold Ring", blurb: "A personal treasure from someone aboard.", points: 6, image: "images/artifacts/gold_ring.png" },
  { key: "gold_necklace", name: "Gold Necklace", blurb: "Hidden in a lacquer box for centuries.", points: 7, image: "images/artifacts/gold_necklace.png" },
  { key: "gilded_bracelet", name: "Gilded Dragon Bracelet", blurb: "Twin dragons chasing a pearl—a myth in metal.", points: 8, image: "images/artifacts/gilded_bracelet.jpg" },
  { key: "gilded_belt", name: "Gilded Belt Buckle", blurb: "Persian-inspired design, a Silk Road fusion.", points: 10, image: "images/artifacts/gilded_belt.jpg" }
];

function buildFragments() {
  const out = [];
  let id = 1;
  ARTIFACTS.forEach(a => {
    for (let q = 1; q <= 4; q++) {
      out.push({
        id: id++,
        artifactKey: a.key,
        artifactName: a.name,
        blurb: a.blurb,
        image: a.image,
        quadrant: q,
        points: a.points,
        foundBy: null
      });
    }
  });
  return out;
}

// Initialize db and start server
db.read().then(() => {
  if (!db.data) db.data = {};
  if (!db.data.players) db.data.players = [];
  if (!db.data.fragments || db.data.fragments.length === 0) db.data.fragments = buildFragments();
  db.write().then(startServer);
});

// ------------------ Start Server ------------------
function startServer() {
  // Register player
  app.post("/new-player", (req, res) => {
    const name = (req.body.name || "").trim();
    if (!name) return res.json({ ok: false, message: "Please enter a name." });

    db.read().then(() => {
      let player = db.data.players.find(p => p.name === name);
      if (!player) db.data.players.push({ name, score: 0 });
      db.write().then(() => {
        io.emit("leaderboard-update", db.data.players);
        res.json({ ok: true });
      });
    });
  });

  // Collect artifact fragment
  app.post("/dive", (req, res) => {
    const name = (req.body.username || "").trim();
    if (!name) return res.json({ ok: false, message: "Please enter your name." });

    db.read().then(() => {
      let player = db.data.players.find(p => p.name === name);
      if (!player) {
        player = { name, score: 0 };
        db.data.players.push(player);
      }

      const available = db.data.fragments.filter(f => !f.foundBy);

      // Reset when all found
      if (available.length === 0) {
        db.data.players.forEach(p => p.score = 0);
        db.data.fragments = buildFragments();
        db.write().then(() => {
          io.emit("leaderboard-update", db.data.players);
          io.emit("fragment-found", null);
          res.json({ ok: true, reset: true, message: "All fragments recovered. The sea resets for a new dive." });
        });
        return;
      }

      // Random fragment
      const pick = available[Math.floor(Math.random() * available.length)];
      pick.foundBy = name;
      player.score += pick.points;

      // Bonus for completing full artifact
      const related = db.data.fragments.filter(f => f.artifactKey === pick.artifactKey && f.foundBy);
      if (related.length === 4) {
        const contributors = new Set(related.map(f => f.foundBy));
        db.data.players.forEach(p => { if (contributors.has(p.name)) p.score += 5; });
      }

      db.write().then(() => {
        io.emit("fragment-found", pick);
        io.emit("leaderboard-update", db.data.players);
        res.json({ ok: true, fragment: pick, leaderboard: db.data.players, message: `You found a fragment of "${pick.artifactName}".` });
      });
    });
  });

  // Data for gallery
  app.get("/data", (req, res) => db.read().then(() => res.json(db.data)));

  //active users tracking
  io.on("connection", socket => {
    if (activeUsers >= MAX_USERS) {
      socket.emit('server-full', { message: 'Server is at capacity. Please try again later.' });
      socket.disconnect(true);
      return;
    }

    activeUsers++;
    console.log(`User connected. Active users: ${activeUsers}/${MAX_USERS}`);
    
    //leaderboard update
    socket.emit("leaderboard-update", db.data.players);

    socket.on('disconnect', () => {
      activeUsers--;
      console.log(`User disconnected. Active users: ${activeUsers}/${MAX_USERS}`);
    });
  });

  const PORT = 3000;
  server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
