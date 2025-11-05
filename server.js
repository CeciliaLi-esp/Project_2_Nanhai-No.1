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
  { 
    key: "empty_box", 
    name: "Empty Box", 
    blurbs: [
      "Sorry, someone got here before you did!",
      "Sorry, someone got here before you did!",
      "Sorry, someone got here before you did!",
      "Sorry, someone got here before you did!"
    ],
    points: 0, 
    image: "images/artifacts/Box.png" 
  },
  { 
    key: "coins", 
    name: "Copper Coins", 
    blurbs: [
      "Mixed cash coins from Han to Southern Song periods reveal centuries of circulation along the Maritime Silk Road.",
      "Mint marks trace Fujian and Guangdong workshops—maritime provinces key to Song-era trade",
      "Corrosion and sand infill suggest long submersion and shifting currents across the seabed",
      "Identical coins appear in Indonesia and the Philippines—evidence of a shared trade zone."
    ],
    points: 1, 
    image: "images/artifacts/Coin.png" 
  },
  { 
    key: "silver_ingot", 
    name: "Stamped Silver Ingot", 
    blurbs: [
      "Stamped with shop names and weights, these ingots acted like signed contracts in metal.",
      "Marks such as 京销 linked the silver to Hangzhou's commercial guilds.",
      "They reveal Song-era trust networks spanning China's port cities.",
      "Similar ingots have been found in Quanzhou and Guangzhou, mapping sea-based finance."
    ],
    points: 2, 
    image: "images/artifacts/SilverIngot.png" 
  },
  { 
    key: "longquan", 
    name: "Longquan Celadon Plate", 
    blurbs: [
      "Produced in Zhejiang's Longquan kilns, famed for jade-green glaze and carved lotus motifs",
      "Celadon became China's most exported ware from the 12th to 14th centuries.",
      "Its translucent glaze was prized in Persia and the Islamic world.",
      "Identical shards have been excavated as far as Egypt and Kenya"
    ],
    points: 3, 
    image: "images/artifacts/Plate.png" 
  },
  { 
    key: "white_ewer", 
    name: "White Glazed Ewer", 
    blurbs: [
      "Qingbai porcelain from Jingdezhen catered to export markets across Asia.",
      "Its light body and thin walls made it perfect for long maritime journeys",
      "Used for wine or water, merging utility and elegance.",
      "Its flared rim reflects Tang and Song aesthetic ideals of purity."
    ],
    points: 4, 
    image: "images/artifacts/Ewer.png" 
  },
  { 
    key: "jade_arhat", 
    name: "Jade Arhat Figurine", 
    blurbs: [
      "A tiny jade carving carried for spiritual protection at sea.",
      "Arhats represent enlightened disciples in Buddhist tradition.",
      "Reflects the fusion of trade and belief along China's southern coasts.",
      "Carved from nephrite, valued for moral purity in Song China."
    ],
    points: 5, 
    image: "images/artifacts/JadeFigure.png" 
  },
  { 
    key: "gold_ring", 
    name: "Gold Ring", 
    blurbs: [
      "Found near crew quarters—possibly a merchant's personal treasure",
      "Some rings retained pearls; others held only empty bezels",
      "Song-era goldwork reveals advanced metallurgy and sentimentality.",
      "Its small size hints at a woman's ring—perhaps a farewell gift."
    ],
    points: 6, 
    image: "images/artifacts/Ring.png" 
  },
  { 
    key: "gold_necklace", 
    name: "Gold Necklace", 
    blurbs: [
      "Recovered from a sealed lacquer box in the cargo hold.",
      "Demonstrates fine filigree technique used in Song-court jewelry.",
      "Shows how valuables were packed and insured for maritime travel.",
      "Similar chains appear in 12th-century Song portraits of nobility."
    ],
    points: 7, 
    image: "images/artifacts/Necklace.png" 
  },
  { 
    key: "gilded_bracelet", 
    name: "Gilded Dragon Bracelet", 
    blurbs: [
      "Two dragons chasing a pearl—a symbol of imperial power and protection.",
      "Scholars debate whether such pieces were bracelets or decorative fittings.",
      "Represents fusion of Chinese symbolism and maritime craftsmanship",
      "Its meaning remains thrillingly unsettled between adornment and ritual."
    ],
    points: 8, 
    image: "images/artifacts/Bracelet.png" 
  },
  { 
    key: "gilded_belt", 
    name: "Gilded Belt Buckle", 
    blurbs: [
      "A 1.7-meter belt woven from gilded strands, echoing West Asian metalwork.",
      "Its clasp and scroll pattern reflect Tang-to-Song cross-cultural exchange.",
      "Combines Chinese craftsmanship with Persian aesthetic geometry.",
      "A masterpiece of East-West fashion along the Maritime Silk Road."
    ],
    points: 10, 
    image: "images/artifacts/Belt.png" 
  }
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
        blurb: a.blurbs[q - 1],  // Use the specific blurb for this quadrant
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
        //resets players instead of only reseting scores like the previous version 
        db.data.players = [];
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
