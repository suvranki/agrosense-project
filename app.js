"use strict";

const API = "http://localhost:3000/api";

const CROPS_DB = [
  { id:"wheat",     name:"Wheat",     icon:"🌾", waterNeed:450,  growDays:120 },
  { id:"rice",      name:"Rice",      icon:"🌾", waterNeed:1200, growDays:150 },
  { id:"corn",      name:"Corn",      icon:"🌽", waterNeed:600,  growDays:100 },
  { id:"tomato",    name:"Tomato",    icon:"🍅", waterNeed:380,  growDays:80  },
  { id:"potato",    name:"Potato",    icon:"🥔", waterNeed:500,  growDays:90  },
  { id:"cotton",    name:"Cotton",    icon:"☁️", waterNeed:700,  growDays:180 },
  { id:"soybean",   name:"Soybean",   icon:"🫘", waterNeed:450,  growDays:110 },
  { id:"sugarcane", name:"Sugarcane", icon:"🎋", waterNeed:1500, growDays:365 },
];

const INDIAN_STATES = [
  "Andhra Pradesh","Assam","Bihar","Chhattisgarh","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Odisha","Punjab","Rajasthan",
  "Tamil Nadu","Telangana","Uttar Pradesh","Uttarakhand","West Bengal"
];


const LS = {
  get: k  => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k  => localStorage.removeItem(k),
};


function toast(msg, type = "ok") {
  let c = document.getElementById("toasts");
  if (!c) { c = document.createElement("div"); c.id = "toasts"; document.body.appendChild(c); }
  const t = document.createElement("div");
  t.className = `toast ${type === "warn" ? "warn" : type === "info" ? "info" : type === "alrt" ? "alrt" : ""}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, 3800);
}

function initParticles() {
  const c = document.getElementById("particles");
  if (!c) return;
  const cols = ["#4dff91", "#4dc8ff", "#a259ff"];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const sz = Math.random() * 5 + 2;
    Object.assign(p.style, {
      width:  sz + "px", height: sz + "px",
      background: cols[i % 3],
      left: Math.random() * 100 + "%",
      top:  Math.random() * 100 + "%",
      animationDuration: (6 + Math.random() * 8) + "s",
      animationDelay:    (Math.random() * 5) + "s",
    });
    c.appendChild(p);
  }
}


const $  = id => document.getElementById(id);
const gv = id => { const el = $(id); return el ? el.value.trim() : ""; };
const sv = (id, v) => { const el = $(id); if (el) el.value = v; };
const si = (id, h) => { const el = $(id); if (el) el.innerHTML = h; };

let currentTab = "login";

function initAuthPage() {
  initParticles();
  const user = LS.get("user");
  const farm = LS.get("farm");
  if (user && farm) { location.href = "dashboard.html"; return; }
  if (user && !farm) { location.href = "field.html"; return; }
}

function switchTab(tab) {
  currentTab = tab;
  ["login","signup","guest"].forEach(t => {
    $("tab-" + t)?.classList.toggle("hidden", t !== tab);
    document.querySelector(`[data-tab="${t}"]`)?.classList.toggle("active", t === tab);
  });
}

async function handleLogin() {
  const email    = gv("login-email");
  const password = gv("login-password");
  if (!email || !password) { shakeCard(); toast("Please fill in email and password.", "warn"); return; }
  try {
    const res  = await fetch(`${API}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Login failed.", "warn"); return; }
    LS.set("user", data.user);
    toast("Welcome back, " + data.user.name + "!");
    setTimeout(() => location.href = LS.get("farm") ? "dashboard.html" : "field.html", 700);
  } catch {
    /* offline fallback */
    const user = { id: Date.now(), name: email.split("@")[0] || "Farmer", email, guest: false };
    LS.set("user", user);
    toast("Offline mode – logged in locally.", "info");
    setTimeout(() => location.href = LS.get("farm") ? "dashboard.html" : "field.html", 700);
  }
}

async function handleSignup() {
  const name     = gv("su-name");
  const age      = gv("su-age");
  const email    = gv("su-email");
  const phone    = gv("su-phone");
  const password = gv("su-password");
  if (!name || !age)         { shakeCard(); toast("Name and age are required.", "warn"); return; }
  if (!email && !phone)      { shakeCard(); toast("Provide at least an email or phone.", "warn"); return; }
  if (password.length < 6)   { toast("Password must be at least 6 characters.", "warn"); return; }
  try {
    const res  = await fetch(`${API}/signup`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, age: Number(age), email, phone, password })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Signup failed.", "warn"); return; }
    LS.set("user", data.user);
    toast("Account created! Set up your profile.");
    setTimeout(() => location.href = "signup.html", 700);
  } catch {
    const user = { id: Date.now(), name, age: Number(age), email, phone, guest: false };
    LS.set("user", user);
    toast("Offline – profile saved locally.", "info");
    setTimeout(() => location.href = "signup.html", 700);
  }
}

function handleGoogleLogin() {
  const user = { id: Date.now(), name: "Google User", email: "user@gmail.com", gmail: "user@gmail.com", google: true };
  LS.set("user", user);
  toast("Signed in with Google!");
  setTimeout(() => location.href = LS.get("farm") ? "dashboard.html" : "field.html", 700);
}

function handleGuest() {
  const user = { id: Date.now(), name: "Guest Farmer", guest: true };
  LS.set("user", user);
  toast("Entering as guest...", "info");
  setTimeout(() => location.href = "field.html", 700);
}

function shakeCard() {
  const c = $("auth-card");
  if (!c) return;
  c.classList.add("shake");
  setTimeout(() => c.classList.remove("shake"), 500);
}


function initProfilePage() {
  initParticles();
  const user = LS.get("user");
  if (!user) { location.href = "index.html"; return; }
  const el = $("welcome-name");
  if (el) el.textContent = "WELCOME, " + (user.name || "FARMER").toUpperCase();
  if (user.name)  sv("p-name",  user.name);
  if (user.age)   sv("p-age",   user.age);
  if (user.email) sv("p-email", user.email);
  if (user.gmail) sv("p-gmail", user.gmail);
  if (user.phone) sv("p-phone", user.phone);
}

async function saveProfile() {
  const name   = gv("p-name");
  const age    = gv("p-age");
  const email  = gv("p-email");
  const gmail  = gv("p-gmail");
  const phone  = gv("p-phone");
  const lang   = gv("p-lang");
  const gender = gv("p-gender");
  if (!name || !age) { toast("Name and age are required.", "warn"); return; }
  const user = { ...LS.get("user"), name, age: Number(age), email, gmail, phone, lang, gender };
  LS.set("user", user);
  try {
    await fetch(`${API}/user/${user.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(user)
    });
  } catch { /* offline */ }
  toast("Profile saved!");
  setTimeout(() => location.href = "field.html", 600);
}


let fieldStep     = 0;
let selectedCrops = [];
let cropCount     = 1;

function initFieldPage() {
  initParticles();
  const user = LS.get("user");
  if (!user) { location.href = "index.html"; return; }
  const el = $("farm-welcome");
  if (el) el.textContent = "LET'S SET UP YOUR FIELD, " + (user.name || "FARMER").toUpperCase();

  // Populate state dropdown
  const sel = $("f-state");
  if (sel) {
    INDIAN_STATES.forEach(s => {
      const o = document.createElement("option");
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
  }

  buildCropGrid();
  updateStepUI();
}

function nextStep(cur) {
  if (cur === 0) {
    if (!gv("f-city") || !gv("f-state")) { toast("City and state are required.", "warn"); return; }
  }
  if (cur === 1) {
    if (!gv("f-size") || Number(gv("f-size")) < 100) { toast("Enter a valid field size (min 100 sq.ft).", "warn"); return; }
  }
  fieldStep = cur + 1;
  updateStepUI();
}

function prevStep(cur) {
  fieldStep = cur - 1;
  updateStepUI();
}

function updateStepUI() {
  for (let i = 0; i < 4; i++) {
    $("step-" + i)?.classList.toggle("hidden", i !== fieldStep);
    const line = $("sl-" + i);
    const name = $("sn-" + i);
    if (line) line.classList.toggle("done", i <= fieldStep);
    if (name) { name.classList.toggle("active", i === fieldStep); }
  }
}

function setFieldSize(val) {
  sv("f-size", val);
  document.querySelectorAll(".quick-pill").forEach(p => {
    p.classList.toggle("active", p.getAttribute("onclick") === `setFieldSize(${val})`);
  });
}

function adjustCrops(delta) {
  cropCount = Math.max(1, Math.min(5, cropCount + delta));
  const el = $("crop-count-display");
  const pl = $("crop-plural");
  const msg = $("crop-count-msg");
  if (el)  el.textContent = cropCount;
  if (pl)  pl.textContent = cropCount > 1 ? "S" : "";
  if (msg) msg.textContent = [
    "Single crop — dedicated Node 1 sensor zone",
    "2 crops — dual zone monitoring",
    "3 crops — tri-zone monitoring",
    "4 crops — multi-zone monitoring",
    "5 crops — full multi-zone monitoring",
  ][cropCount - 1];
  const label  = $("select-count-label");
  const plural = $("select-plural");
  if (label)  label.textContent  = cropCount;
  if (plural) plural.textContent = cropCount > 1 ? "S" : "";
  if (selectedCrops.length > cropCount) {
    selectedCrops = selectedCrops.slice(0, cropCount);
    buildCropGrid();
  }
}

function buildCropGrid() {
  const grid = $("crop-grid");
  if (!grid) return;
  grid.innerHTML = CROPS_DB.map(c => {
    const sel = selectedCrops.find(s => s.id === c.id);
    return `
      <div class="crop-card ${sel ? "selected" : ""}" onclick="toggleCrop('${c.id}')">
        <span class="crop-emoji">${c.icon}</span>
        <div>
          <div class="crop-name">${c.name}</div>
          <div class="crop-water">${c.waterNeed} L/week</div>
        </div>
        <span class="crop-check">✓</span>
      </div>`;
  }).join("");
  updateSelStatus();
}

function toggleCrop(id) {
  const crop = CROPS_DB.find(c => c.id === id);
  const idx  = selectedCrops.findIndex(c => c.id === id);
  if (idx >= 0) {
    selectedCrops.splice(idx, 1);
  } else {
    if (selectedCrops.length >= cropCount) {
      toast(`Max ${cropCount} crop${cropCount > 1 ? "s" : ""} allowed.`, "warn"); return;
    }
    selectedCrops.push(crop);
  }
  buildCropGrid();
}

function updateSelStatus() {
  const el = $("selection-status");
  if (!el) return;
  if (!selectedCrops.length) {
    el.textContent = "No crops selected yet";
    el.style.color = "var(--dim)";
  } else {
    el.innerHTML = selectedCrops.map(c => `${c.icon} ${c.name}`).join("  ·  ");
    el.style.color = selectedCrops.length === cropCount ? "var(--g)" : "var(--c)";
  }
}

async function launchDashboard() {
  if (selectedCrops.length !== cropCount) {
    toast(`Select exactly ${cropCount} crop${cropCount > 1 ? "s" : ""}.`, "warn"); return;
  }
  const farm = {
    city:      gv("f-city"),
    state:     gv("f-state"),
    district:  gv("f-district"),
    fieldSize: Number(gv("f-size")),
    soilType:  gv("f-soil"),
    cropCount,
    crops:     selectedCrops,
    createdAt: new Date().toISOString(),
  };
  LS.set("farm", farm);
  const user = LS.get("user");
  try {
    await fetch(`${API}/farm`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user?.id, ...farm })
    });
  } catch { /* offline */ }
  toast("Farm configured! Launching dashboard...");
  setTimeout(() => location.href = "dashboard.html", 800);
}

function handleLogout() {
  if (!confirm("Logout from AgroSense?")) return;
  LS.del("user");
  LS.del("farm");
  location.href = "index.html";
}