/* ═══════════════════════════════════════════════════════════════
   AGROSENSE — diseasePredictor.js
   AI Crop Disease Prediction Engine
   
   HOW IT WORKS:
   - Analyses last 7 days of moisture + temperature history
   - Uses rule-based ML logic (no external API needed)
   - Predicts disease risk BEFORE it happens
   - Each crop has different disease thresholds
   ═══════════════════════════════════════════════════════════════ */
"use strict";

/* ── DISEASE KNOWLEDGE BASE ──────────────────────────────────────
   Each disease has:
   - conditions: what triggers it
   - risk: how dangerous it is
   - solution: what farmer should do
   ──────────────────────────────────────────────────────────────── */
const DISEASE_DB = {

  // ── FUNGAL DISEASES (high moisture) ─────────────────────────────
  fungal_rot: {
    name:      "Root Rot",
    type:      "Fungal",
    emoji:     "🍄",
    severity:  "HIGH",
    condition: (h) => h.avgMoisture > 70 && h.highMoistureDays >= 3,
    crops:     ["wheat","rice","corn","tomato","potato","soybean"],
    message:   "Soil too wet for 3+ days — root rot risk!",
    solution:  "Reduce irrigation immediately. Improve drainage. Apply fungicide if symptoms appear.",
    color:     "#ff4d4d"
  },

  powdery_mildew: {
    name:      "Powdery Mildew",
    type:      "Fungal",
    emoji:     "🌫️",
    severity:  "MEDIUM",
    condition: (h) => h.avgMoisture > 60 && h.avgMoisture < 80 && h.moistureSwings > 3,
    crops:     ["wheat","corn","cotton","sugarcane"],
    message:   "Fluctuating moisture — mildew risk!",
    solution:  "Maintain consistent moisture levels. Ensure good air circulation.",
    color:     "#ffd04d"
  },

  blight: {
    name:      "Late Blight",
    type:      "Fungal",
    emoji:     "🟤",
    severity:  "HIGH",
    condition: (h) => h.avgMoisture > 65 && h.consecutiveWetNights >= 2,
    crops:     ["potato","tomato"],
    message:   "High moisture nights — blight risk!",
    solution:  "Apply copper-based fungicide. Avoid watering in evening.",
    color:     "#ff4d4d"
  },

  // ── BACTERIAL DISEASES (dry-wet cycles) ──────────────────────────
  bacterial_wilt: {
    name:      "Bacterial Wilt",
    type:      "Bacterial",
    emoji:     "🦠",
    severity:  "HIGH",
    condition: (h) => h.dryWetCycles >= 3,
    crops:     ["tomato","potato","corn"],
    message:   "Repeated dry-wet cycles — bacterial wilt risk!",
    solution:  "Maintain steady moisture 40-60%. Avoid extreme dry spells.",
    color:     "#ff4d4d"
  },

  // ── STRESS CONDITIONS (too dry) ───────────────────────────────────
  drought_stress: {
    name:      "Drought Stress",
    type:      "Abiotic",
    emoji:     "🏜️",
    severity:  "MEDIUM",
    condition: (h) => h.avgMoisture < 25 && h.dryDays >= 2,
    crops:     ["wheat","corn","cotton","soybean","sugarcane"],
    message:   "Soil too dry — drought stress risk!",
    solution:  "Increase irrigation frequency. Check pump is working correctly.",
    color:     "#ffa500"
  },

  // ── WATERLOGGING ──────────────────────────────────────────────────
  waterlogging: {
    name:      "Waterlogging",
    type:      "Abiotic",
    emoji:     "💦",
    severity:  "HIGH",
    condition: (h) => h.avgMoisture > 85 && h.highMoistureDays >= 4,
    crops:     ["wheat","cotton","soybean"],
    message:   "Severely waterlogged — crop suffocation risk!",
    solution:  "Stop irrigation immediately. Create drainage channels.",
    color:     "#ff4d4d"
  }
};

/* ── ANALYSE HISTORY ─────────────────────────────────────────────
   Takes last 7 days of moisture history
   Returns analysis object used by disease conditions
   ──────────────────────────────────────────────────────────────── */
function analyseHistory(history) {
  if (!history || history.length === 0) {
    return { avgMoisture: 50, highMoistureDays: 0, dryDays: 0,
             moistureSwings: 0, dryWetCycles: 0, consecutiveWetNights: 0 };
  }

  const moistures = history.map(h => h.moisture || h.readings?.[0] || 50).filter(m => m !== null);
  const avgMoisture = moistures.reduce((a, b) => a + b, 0) / moistures.length;

  // Count high moisture days (> 70%)
  const highMoistureDays = moistures.filter(m => m > 70).length;

  // Count dry days (< 30%)
  const dryDays = moistures.filter(m => m < 30).length;

  // Count moisture swings (change > 20% between days)
  let moistureSwings = 0;
  for (let i = 1; i < moistures.length; i++) {
    if (Math.abs(moistures[i] - moistures[i-1]) > 20) moistureSwings++;
  }

  // Count dry-wet cycles
  let dryWetCycles = 0;
  let wasDry = false;
  for (const m of moistures) {
    if (m < 35 && !wasDry) { wasDry = true; }
    if (m > 60 && wasDry)  { dryWetCycles++; wasDry = false; }
  }

  // Consecutive wet periods
  let consecutiveWetNights = 0;
  let maxConsecutive = 0;
  for (const m of moistures) {
    if (m > 65) { consecutiveWetNights++; maxConsecutive = Math.max(maxConsecutive, consecutiveWetNights); }
    else { consecutiveWetNights = 0; }
  }

  return {
    avgMoisture:          Math.round(avgMoisture),
    highMoistureDays,
    dryDays,
    moistureSwings,
    dryWetCycles,
    consecutiveWetNights: maxConsecutive,
    totalDays:            moistures.length
  };
}

/* ── PREDICT DISEASES ────────────────────────────────────────────
   Main prediction function
   crops = array of crop objects from farm
   history = last 7 days moisture history from Firebase
   ──────────────────────────────────────────────────────────────── */
function predictDiseases(crops, history) {
  const analysis   = analyseHistory(history);
  const cropIds    = crops.map(c => c.id);
  const predictions = [];

  // Check each disease
  for (const [id, disease] of Object.entries(DISEASE_DB)) {
    // Check if any of farmer's crops are at risk
    const affectedCrops = crops.filter(c => disease.crops.includes(c.id));
    if (affectedCrops.length === 0) continue;

    // Check if conditions are met
    if (disease.condition(analysis)) {
      predictions.push({
        id,
        name:          disease.name,
        type:          disease.type,
        emoji:         disease.emoji,
        severity:      disease.severity,
        message:       disease.message,
        solution:      disease.solution,
        color:         disease.color,
        affectedCrops: affectedCrops.map(c => c.name),
        riskScore:     calculateRiskScore(disease, analysis),
        analysis
      });
    }
  }

  // Sort by risk score (highest first)
  predictions.sort((a, b) => b.riskScore - a.riskScore);

  return {
    predictions,
    analysis,
    overallRisk: predictions.length === 0 ? "LOW" :
                 predictions.some(p => p.severity === "HIGH") ? "HIGH" : "MEDIUM",
    healthScore: calculateHealthScore(analysis, predictions)
  };
}

/* ── CALCULATE RISK SCORE (0-100) ───────────────────────────────── */
function calculateRiskScore(disease, analysis) {
  let score = 50;
  if (disease.severity === "HIGH")   score += 30;
  if (disease.severity === "MEDIUM") score += 15;
  if (analysis.highMoistureDays > 4) score += 20;
  if (analysis.dryWetCycles > 3)     score += 15;
  if (analysis.moistureSwings > 4)   score += 10;
  return Math.min(score, 100);
}

/* ── CALCULATE CROP HEALTH SCORE (0-100) ────────────────────────── */
function calculateHealthScore(analysis, predictions) {
  let score = 100;

  // Deduct for diseases
  score -= predictions.filter(p => p.severity === "HIGH").length   * 25;
  score -= predictions.filter(p => p.severity === "MEDIUM").length * 15;

  // Deduct for moisture issues
  if (analysis.avgMoisture < 25)  score -= 20; // too dry
  if (analysis.avgMoisture > 80)  score -= 20; // too wet
  if (analysis.moistureSwings > 4) score -= 10; // unstable
  if (analysis.dryWetCycles > 2)  score -= 10; // cycling

  // Bonus for optimal moisture
  if (analysis.avgMoisture >= 35 && analysis.avgMoisture <= 65) score += 10;

  return Math.max(0, Math.min(100, score));
}

module.exports = { predictDiseases, analyseHistory };