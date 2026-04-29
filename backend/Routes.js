/* ═══════════════════════════════════════════════════════════════
   AGROSENSE — routes.js
   Firebase Firestore version
   Receives db and admin as parameters from server.js
   ═══════════════════════════════════════════════════════════════ */
"use strict";
const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { v4: uuid } = require("uuid");

const JWT_SECRET = process.env.JWT_SECRET || "agrosense_jwt_secret_2024";

module.exports = function(db, admin) {

  const router = express.Router();

  /* ── AUTH MIDDLEWARE ───────────────────────────────────────── */
  function auth(req, res, next) {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { res.status(401).json({ error: "Invalid token" }); }
  }

  /* ════════════════════════════════════════════════════════════
     AUTH
     ════════════════════════════════════════════════════════════ */

  // POST /api/signup
  router.post("/signup", async (req, res) => {
    try {
      const { name, age, email, phone, password, gmail, lang, gender } = req.body;
      if (!name || !age)    return res.status(400).json({ error: "Name and age required." });
      if (!email && !phone) return res.status(400).json({ error: "Provide email or phone." });
      if (!password || password.length < 6) return res.status(400).json({ error: "Password min 6 chars." });

      // Check duplicate email
      if (email) {
        const existing = await db.collection("users").where("email", "==", email).get();
        if (!existing.empty) return res.status(400).json({ error: "Email already registered." });
      }

      const id   = uuid();
      const user = {
        id, name, age: +age,
        email:    email    || null,
        gmail:    gmail    || email || null,
        phone:    phone    || null,
        password: await bcrypt.hash(password, 10),
        lang:     lang     || "en",
        gender:   gender   || null,
        guest:    false,
        createdAt: new Date().toISOString()
      };

      await db.collection("users").doc(id).set(user);
      const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: "30d" });
      const { password: _, ...safe } = user;
      res.status(201).json({ user: safe, token });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/login
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required." });

      // Find by email or phone
      let snap = await db.collection("users").where("email", "==", email).get();
      if (snap.empty) snap = await db.collection("users").where("phone", "==", email).get();
      if (snap.empty) return res.status(404).json({ error: "User not found." });

      const user = snap.docs[0].data();
      if (!(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ error: "Wrong password." });

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });
      const { password: _, ...safe } = user;
      res.json({ user: safe, token });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/guest
  router.post("/guest", async (req, res) => {
    try {
      const id   = uuid();
      const user = { id, name: "Guest Farmer", guest: true, createdAt: new Date().toISOString() };
      await db.collection("users").doc(id).set(user);
      const token = jwt.sign({ id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ user, token });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/user/:id
  router.get("/user/:id", auth, async (req, res) => {
    try {
      const doc = await db.collection("users").doc(req.params.id).get();
      if (!doc.exists) return res.status(404).json({ error: "Not found." });
      const { password: _, ...safe } = doc.data();
      res.json(safe);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/user/:id
  router.put("/user/:id", auth, async (req, res) => {
    try {
      const { password, ...upd } = req.body;
      if (password && password.length >= 6) upd.password = await bcrypt.hash(password, 10);
      await db.collection("users").doc(req.params.id).update(upd);
      const doc = await db.collection("users").doc(req.params.id).get();
      const { password: _, ...safe } = doc.data();
      res.json(safe);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════
     FARM
     ════════════════════════════════════════════════════════════ */

  // POST /api/farm
  router.post("/farm", async (req, res) => {
    try {
      const id   = uuid();
      const farm = { id, ...req.body, createdAt: new Date().toISOString() };
      await db.collection("farms").doc(id).set(farm);
      res.status(201).json(farm);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/farm/:userId
  router.get("/farm/:userId", async (req, res) => {
    try {
      const snap = await db.collection("farms").where("userId", "==", req.params.userId).get();
      if (snap.empty) return res.status(404).json({ error: "No farm found." });
      res.json(snap.docs[0].data());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/farm/:id
  router.put("/farm/:id", auth, async (req, res) => {
    try {
      await db.collection("farms").doc(req.params.id).update(req.body);
      const doc = await db.collection("farms").doc(req.params.id).get();
      res.json(doc.data());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════
     SENSORS
     ════════════════════════════════════════════════════════════ */

  // GET /api/sensors
  router.get("/sensors", async (_req, res) => {
    try {
      const snap = await db.collection("sensors").get();
      res.json(snap.docs.map(d => d.data()));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sensors/:nodeId
  router.get("/sensors/:nodeId", async (req, res) => {
    try {
      const doc = await db.collection("sensors").doc(req.params.nodeId).get();
      if (!doc.exists) return res.status(404).json({ error: "Node not found." });
      res.json(doc.data());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════
     PUMP
     ════════════════════════════════════════════════════════════ */

  // POST /api/pump
  router.post("/pump", async (req, res) => {
    try {
      const { nodeId, state, liters, cropName } = req.body;
      if (!nodeId || state === undefined)
        return res.status(400).json({ error: "nodeId and state required." });

      if (state) {
        const id = uuid();
        await db.collection("pumpLogs").doc(id).set({
          id, nodeId,
          cropName:  cropName || "Unknown",
          liters:    Math.round(liters || 0),
          state:     true,
          trigger:   "Manual",
          path:      "N1→N2(relay)→N3(pump)",
          timestamp: new Date().toISOString()
        });

        // Update today's history
        const today = new Date().toLocaleDateString("en-IN", { month:"short", day:"2-digit" });
        await db.collection("moistureHistory").doc(today).set(
          { pumpOn: true }, { merge: true }
        );
      }
      res.json({ ok: true, nodeId, state });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/pump/logs
  router.get("/pump/logs", async (_req, res) => {
    try {
      const snap = await db.collection("pumpLogs")
        .orderBy("timestamp", "desc").limit(50).get();
      res.json(snap.docs.map(d => d.data()));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════
     HISTORY
     ════════════════════════════════════════════════════════════ */

  // GET /api/history
  router.get("/history", async (_req, res) => {
    try {
      const snap = await db.collection("moistureHistory")
        .orderBy("date").limit(30).get();
      res.json(snap.docs.map(d => d.data()));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/history/summary
  router.get("/history/summary", async (_req, res) => {
    try {
      const snap = await db.collection("moistureHistory")
        .orderBy("date").limit(30).get();
      const hist = snap.docs.map(d => d.data());
      if (!hist.length) return res.json({ avg: 0, pumpDays: 0, dryDays: 0, totalDays: 0 });
      const vals = hist.map(h => h.moisture).filter(v => v !== null);
      const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
      res.json({
        avg:       Math.round(avg),
        pumpDays:  hist.filter(h => h.pumpOn).length,
        dryDays:   hist.filter(h => h.moisture < 30).length,
        totalDays: hist.length,
        history:   hist
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* ════════════════════════════════════════════════════════════
     WEATHER
     ════════════════════════════════════════════════════════════ */
  router.get("/weather", (req, res) => {
    res.json({
      city: req.query.city || "Nagpur",
      temp: 27 + Math.round(Math.random() * 6),
      hum:  60 + Math.round(Math.random() * 20),
      wind: 8  + Math.round(Math.random() * 12),
      uv:   5  + Math.round(Math.random() * 4),
      cond: ["Sunny","Partly Cloudy","Overcast","Light Rain"][Math.floor(Math.random()*4)],
      icon: ["☀️","⛅","🌥️","🌦️"][Math.floor(Math.random()*4)],
      forecast: ["Mon","Tue","Wed","Thu","Fri"].map(d => ({
        d, icon: ["☀️","⛅","🌧️","🌦️"][Math.floor(Math.random()*4)],
        h: 26+Math.floor(Math.random()*10), l: 18+Math.floor(Math.random()*8)
      }))
    });
  });

  return router;
};

/* ════════════════════════════════════════════════════════════════
   AI DISEASE PREDICTION
   GET /api/predict/:userId
   Analyses last 7 days moisture history and predicts disease risk
   ════════════════════════════════════════════════════════════════ */
const { predictDiseases } = require("./diseasePredictor");

router.get("/predict/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Get farm data
    const farmSnap = await db.collection("farms")
      .where("userId", "==", userId).get();
    if (farmSnap.empty) return res.status(404).json({ error: "No farm found." });
    const farm = farmSnap.docs[0].data();

    // Get last 7 days moisture history
    const histSnap = await db.collection("moistureHistory")
      .orderBy("date").limitToLast(7).get();
    const history = histSnap.docs.map(d => d.data());

    // Run AI prediction
    const result = predictDiseases(farm.crops || [], history);

    // Save prediction to Firebase
    await db.collection("predictions").add({
      userId,
      farmId:       farm.id,
      ...result,
      timestamp:    admin.firestore.FieldValue.serverTimestamp()
    });

    // Send SSE alert if HIGH risk
    if (result.overallRisk === "HIGH" && global.sendSSE) {
      global.sendSSE("disease_alert", {
        risk:        result.overallRisk,
        healthScore: result.healthScore,
        diseases:    result.predictions.map(p => p.name),
        message:     `⚠ HIGH disease risk detected! ${result.predictions[0]?.name} — ${result.predictions[0]?.message}`
      });
    }

    res.json(result);

  } catch (err) {
    console.error("[PREDICT] error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /api/predict/history/:userId ── last 10 predictions ─── */
router.get("/predict/history/:userId", async (req, res) => {
  try {
    const snap = await db.collection("predictions")
      .where("userId", "==", req.params.userId)
      .orderBy("timestamp", "desc").limit(10).get();
    res.json(snap.docs.map(d => d.data()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});