// Simple HMS backend for CareFinder
// - Admin registration & login for hospital staff
// - Bed availability management per hospital
// - Public bed availability API consumed by the frontend

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const DATA_PATH = path.join(__dirname, "backend-data.json");

// ---------- Data layer ----------

function loadData() {
  if (!fs.existsSync(DATA_PATH)) {
    return seedInitialData();
  }
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed.users || !parsed.hospitals) throw new Error("Invalid data");
    return parsed;
  } catch (e) {
    console.error("Failed to read backend-data.json, reseeding:", e.message);
    return seedInitialData();
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function normalizeName(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/hospital/g, "")
    .replace(/[\s,().-]+/g, " ")
    .trim();
}

function slugify(name = "") {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "hospital";
}

function geocodeAddress(q) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`;
    https
      .get(url, { headers: { "User-Agent": "CareFinder/1.0" } }, (res) => {
        let data = "";
        res.on("data", (ch) => (data += ch));
        res.on("end", () => {
          try {
            const arr = JSON.parse(data);
            if (Array.isArray(arr) && arr[0] && arr[0].lat && arr[0].lon) {
              resolve({ lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) });
            } else resolve(null);
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

function seedInitialData() {
  const passwordPlain = "Kiims@123";
  const passwordHash = bcrypt.hashSync(passwordPlain, 10);

  const kiimsName =
    "Pradyumna Bal Memorial Hospital (Kalinga Inst Of Medical hospital)";

  const data = {
    users: [
      {
        id: "user_kiims_admin",
        name: "KIMS Admin",
        email: "kiims.admin@example.com",
        role: "hospital_staff",
        hospitalKey: "kiims",
        passwordHash
      }
    ],
    hospitals: [
      {
        key: "kiims",
        name: kiimsName,
        aliases: ["KIMS", "KIIMS", "Kalinga Institute of Medical Sciences"],
        normalizedName: normalizeName(kiimsName),
        lat: 20.2961,
        lon: 85.8245,
        contact: {
          address: "KIIT Road, Patia, Bhubaneswar",
          city: "Bhubaneswar",
          state: "Odisha",
          district: "Khordha",
          pincode: "751024",
          phone: ""
        },
        beds: {
          available: 25,
          capacity: 120,
          icu: 10,
          emergency: true
        }
      }
    ]
  };

  saveData(data);
  console.log("Seeded backend data with KIMS admin and hospital record.");
  console.log('Default KIMS admin credentials: email "kiims.admin@example.com", password "Kiims@123"');
  return data;
}

let db = loadData();

// In-memory ambulance trips (for demo)
const trips = new Map(); // id -> trip

// ---------- Express & middleware ----------

app.use(
  cors({
    origin: true, // allow all origins; adjust for production
    credentials: false
  })
);
app.use(express.json());

function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const [, token] = hdr.split(" ");
  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function findHospitalByName(name) {
  if (!name) return null;
  const norm = normalizeName(name);
  // Exact normalized name
  let match = db.hospitals.find((h) => h.normalizedName === norm);
  if (match) return match;

  // Alias match
  match = db.hospitals.find((h) =>
    (h.aliases || []).some((alias) => normalizeName(alias) === norm)
  );
  if (match) return match;

  // Contains match
  match = db.hospitals.find((h) => norm.includes(h.normalizedName));
  if (match) return match;

  return null;
}

// ---------- Auth routes ----------

app.post("/api/auth/register", async (req, res) => {
  const {
    name,
    email,
    password,
    hospitalName,
    hospitalAddress,
    hospitalCity,
    hospitalState,
    hospitalDistrict,
    hospitalPincode,
    hospitalPhone,
    hospitalCapacity,
    hospitalLocation
  } = req.body || {};
  if (!name || !email || !password || !hospitalName) {
    return res.status(400).json({ error: "name, email, password, hospitalName are required" });
  }

  const existing = db.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );
  if (existing) {
    return res.status(409).json({ error: "User with this email already exists" });
  }

  let hospital = findHospitalByName(hospitalName);
  if (!hospital) {
    const key = slugify(hospitalName);
    let lat = null;
    if (
      hospitalLocation &&
      typeof hospitalLocation.lat === "number" &&
      typeof hospitalLocation.lon === "number"
    ) {
      lat = { lat: hospitalLocation.lat, lon: hospitalLocation.lon };
    } else if (hospitalAddress || hospitalPincode || hospitalCity || hospitalState) {
      try {
        const q = [hospitalAddress, hospitalCity, hospitalState, hospitalPincode, "India"]
          .filter(Boolean)
          .join(", ");
        const geo = await geocodeAddress(q);
        if (geo) lat = geo;
      } catch (e) {
        console.warn("Geocode failed for new hospital:", e.message);
      }
    }
    hospital = {
      key,
      name: hospitalName,
      aliases: [],
      normalizedName: normalizeName(hospitalName),
      lat: lat ? lat.lat : null,
      lon: lat ? lat.lon : null,
      beds: {
        available: 0,
        capacity: typeof hospitalCapacity === "number" && Number.isFinite(hospitalCapacity)
          ? Math.max(0, Math.floor(hospitalCapacity))
          : 0,
        icu: 0,
        emergency: false
      },
      contact: {
        address: hospitalAddress || "",
        city: hospitalCity || "",
        state: hospitalState || "",
        district: hospitalDistrict || "",
        pincode: hospitalPincode || "",
        phone: hospitalPhone || ""
      }
    };
    db.hospitals.push(hospital);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const user = {
    id: `user_${Date.now().toString(36)}`,
    name,
    email,
    role: "hospital_staff",
    hospitalKey: hospital.key,
    passwordHash
  };

  db.users.push(user);
  saveData(db);

  return res.status(201).json({
    message: "Registered successfully",
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hospitalKey: user.hospitalKey,
      hospitalName: hospital.name
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = db.users.find(
    (u) => u.email.toLowerCase() === String(email).toLowerCase()
  );
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = bcrypt.compareSync(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const hospital = db.hospitals.find((h) => h.key === user.hospitalKey);

  const token = jwt.sign(
    {
      sub: user.id,
      role: user.role,
      hospitalKey: user.hospitalKey
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      hospitalKey: user.hospitalKey,
      hospitalName: hospital ? hospital.name : null
    }
  });
});

app.get("/api/me", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  const hospital = db.hospitals.find((h) => h.key === user.hospitalKey);
  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    hospitalKey: user.hospitalKey,
    hospitalName: hospital ? hospital.name : null
  });
});

// ---------- Hospital admin routes ----------

app.get("/api/hospitals/mine", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  const hospital = db.hospitals.find((h) => h.key === user.hospitalKey);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });
  return res.json(hospital);
});

app.patch("/api/hospitals/mine/beds", authMiddleware, (req, res) => {
  const user = db.users.find((u) => u.id === req.user.sub);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.role !== "hospital_staff") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const hospital = db.hospitals.find((h) => h.key === user.hospitalKey);
  if (!hospital) return res.status(404).json({ error: "Hospital not found" });

  const { available, capacity, icu, emergency } = req.body || {};

  function toInt(val, fallback) {
    if (val === undefined || val === null || val === "") return fallback;
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
  }

  hospital.beds.available = toInt(available, hospital.beds.available);
  hospital.beds.capacity = toInt(capacity, hospital.beds.capacity);
  hospital.beds.icu = toInt(icu, hospital.beds.icu);
  hospital.beds.emergency = typeof emergency === "boolean" ? emergency : !!hospital.beds.emergency;

  saveData(db);

  return res.json({
    message: "Bed availability updated",
    beds: hospital.beds
  });
});

// ---------- Public: nearby registered hospitals (for hospital finder merge) ----------

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

app.get("/api/hospitals/nearby", (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radiusM = parseInt(req.query.radius, 10) || 5000;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "lat and lon query params required" });
  }
  const withCoords = db.hospitals.filter(
    (h) => Number.isFinite(h.lat) && Number.isFinite(h.lon)
  );
  const radiusKm = radiusM / 1000;
  const nearby = withCoords
    .map((h) => {
      const distanceKm = haversineKm({ lat, lon }, { lat: h.lat, lon: h.lon });
      if (distanceKm > radiusKm) return null;
      return {
        id: `reg/${h.key}`,
        osmUrl: null,
        name: h.name,
        lat: h.lat,
        lon: h.lon,
        address: h.contact?.address || "",
        phone: h.contact?.phone || null,
        website: null,
        distanceKm,
        beds: h.beds || { available: 0, capacity: 0, icu: 0, emergency: false },
        fromBackend: true
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  return res.json({ hospitals: nearby });
});

// ---------- Public bed availability route (used by frontend) ----------

app.post("/api/bed-availability", (req, res) => {
  const { hospitals } = req.body || {};
  if (!Array.isArray(hospitals)) {
    return res.status(400).json({ error: "hospitals must be an array" });
  }

  const results = hospitals
    .map((h) => {
      const name = h.name || "";
      const match = findHospitalByName(name);
      if (!match) return null;
      return {
        id: h.id,
        available: match.beds.available,
        capacity: match.beds.capacity,
        icu: match.beds.icu,
        emergency: match.beds.emergency
      };
    })
    .filter(Boolean);

  return res.json({ beds: results });
});

// ---------- Emergency ambulance (demo) ----------

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function jitterCoordinate(lat, lon, maxMeters) {
  const dx = randomBetween(-maxMeters, maxMeters);
  const dy = randomBetween(-maxMeters, maxMeters);
  const dLat = (dy / 111320) * (180 / Math.PI);
  const dLon = (dx / (111320 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: lat + dLat, lon: lon + dLon };
}

const DRIVER_NAMES = [
  "Rahul Singh",
  "Anil Kumar",
  "Sanjay Mishra",
  "Pavan Reddy",
  "Imran Khan",
  "Vikram Patil",
  "Joseph D'Souza",
  "Pradeep Yadav"
];

function randomDriverName() {
  return DRIVER_NAMES[Math.floor(Math.random() * DRIVER_NAMES.length)];
}

function randomDriverPhone() {
  // Simple Indian-style demo number (not real)
  const start = ["6", "7", "8", "9"][Math.floor(Math.random() * 4)];
  let rest = "";
  for (let i = 0; i < 9; i++) {
    rest += Math.floor(Math.random() * 10);
  }
  return start + rest;
}

app.post("/api/ambulances/request", (req, res) => {
  const {
    pickupAddress,
    pickupLocation,
    dropHospitalName,
    dropLocation,
    ambulanceType = "bls",
    patientName,
    contactNumber
  } = req.body || {};
  if (!pickupAddress && !pickupLocation) {
    return res.status(400).json({ error: "pickupAddress or pickupLocation is required" });
  }

  let effectivePickupLocation = null;
  if (
    pickupLocation &&
    typeof pickupLocation.lat === "number" &&
    typeof pickupLocation.lon === "number" &&
    Number.isFinite(pickupLocation.lat) &&
    Number.isFinite(pickupLocation.lon)
  ) {
    effectivePickupLocation = { lat: pickupLocation.lat, lon: pickupLocation.lon };
  } else {
    // Demo: derive a pseudo coordinate from the address hash anchored in India.
    const hash = Array.from(String(pickupAddress || ""))
      .map((ch) => ch.charCodeAt(0))
      .reduce((a, b) => (a + b * 31) % 100000, 0);
    const baseLat = 20.5937 + ((hash % 1000) - 500) / 1000; // approx ±0.5 deg
    const baseLon = 78.9629 + ((Math.floor(hash / 7) % 1000) - 500) / 1000;
    effectivePickupLocation = { lat: baseLat, lon: baseLon };
  }

  const ambulanceLocation = jitterCoordinate(effectivePickupLocation.lat, effectivePickupLocation.lon, 2000); // ~2 km away

  const etaMinutes = randomBetween(4, 9); // always < 10 min in demo

  const id = `trip_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
  const ambulanceCode =
    (ambulanceType === "icu" ? "ICU" : ambulanceType === "als" ? "ALS" : ambulanceType === "neonatal" ? "NEO" : "BLS") +
    "-" +
    Math.floor(randomBetween(101, 999));

  const trip = {
    id,
    pickupAddress,
    pickupLocation: effectivePickupLocation,
    dropHospitalName: dropHospitalName || null,
    dropLocation:
      dropLocation &&
      typeof dropLocation.lat === "number" &&
      typeof dropLocation.lon === "number" &&
      Number.isFinite(dropLocation.lat) &&
      Number.isFinite(dropLocation.lon)
        ? { lat: dropLocation.lat, lon: dropLocation.lon }
        : null,
    ambulanceType,
    ambulanceCode,
    createdAt: Date.now(),
    etaMinutes,
    status: "en_route",
    ambulanceLocation,
    driverName: randomDriverName(),
    driverPhone: randomDriverPhone()
  };

  trips.set(id, trip);

  return res.status(201).json({ trip });
});

app.get("/api/ambulances/track/:id", (req, res) => {
  const id = req.params.id;
  const trip = trips.get(id);
  if (!trip) {
    return res.status(404).json({ error: "Trip not found" });
  }

  const now = Date.now();
  const elapsedSec = (now - trip.createdAt) / 1000;
  const totalSec = trip.etaMinutes * 60;
  const progress = Math.max(0, Math.min(1, elapsedSec / totalSec));

  const start = trip.ambulanceLocation;
  const end = trip.pickupLocation;

  const currentLat = start.lat + (end.lat - start.lat) * progress;
  const currentLon = start.lon + (end.lon - start.lon) * progress;

  const remainingMinutes = Math.max(0, trip.etaMinutes * (1 - progress));

  const status = progress >= 1 ? "arrived" : "en_route";
  let speedKmph;
  if (status === "arrived") {
    speedKmph = 0;
  } else {
    const base = 25 + (1 - progress) * 15; // faster when further away
    const jitter = randomBetween(-5, 5);
    speedKmph = Math.max(10, Math.round(base + jitter));
  }

  const view = {
    id: trip.id,
    pickupAddress: trip.pickupAddress,
    pickupLocation: trip.pickupLocation,
    dropHospitalName: trip.dropHospitalName || null,
    dropLocation: trip.dropLocation || null,
    ambulanceType: trip.ambulanceType,
    ambulanceCode: trip.ambulanceCode,
    createdAt: trip.createdAt,
    status,
    etaMinutes: remainingMinutes,
    ambulanceLocation: { lat: currentLat, lon: currentLon },
    driverName: trip.driverName,
    driverPhone: trip.driverPhone,
    speedKmph
  };

  if (status === "arrived") {
    // keep trip in memory but clamp ETA to zero
    view.etaMinutes = 0;
  }

  return res.json(view);
});

// ---------- Healthcheck ----------

app.get("/health", (req, res) => {
  res.json({ status: "ok", hospitals: db.hospitals.length, users: db.users.length });
});

// ---------- Start ----------

app.listen(PORT, () => {
  console.log(`CareFinder backend listening on http://localhost:${PORT}`);
});

