require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "stockwise.sid",
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000 }
}));

let pool;
async function connectDatabase() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "user12",
    password: process.env.DB_PASSWORD || "Soni@7895524006",
    database: process.env.DB_NAME || "stockwise_inventory",
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true
  });
  await pool.query("SELECT 1");
  console.log("Connected to MySQL.");
}
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: "Please log in to continue." });
  next();
};
const cleanText = v => typeof v === "string" ? v.trim() : "";
function validateProduct(body) {
  const name = cleanText(body.name), sku = cleanText(body.sku).toUpperCase(), category = cleanText(body.category);
  const price = Number(body.price), quantity = Number(body.quantity), reorder_level = Number(body.reorder_level);
  if (name.length < 2 || name.length > 120) return { error: "Product name must contain 2–120 characters." };
  if (!/^[A-Z0-9_-]{2,40}$/.test(sku)) return { error: "SKU must be 2–40 characters using letters, numbers, _ or -." };
  if (category.length < 2 || category.length > 80) return { error: "Please select a valid category." };
  if (!Number.isFinite(price) || price <= 0 || price > 999999999) return { error: "Price must be greater than zero." };
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100000000) return { error: "Quantity must be a non-negative whole number." };
  if (!Number.isInteger(reorder_level) || reorder_level < 0 || reorder_level > 100000000) return { error: "Reorder level must be a non-negative whole number." };
  return { value: { name, sku, category, price, quantity, reorder_level } };
}

app.get("/api/health", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok", database: "connected" });
}));

app.post("/api/auth/register", asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name), email = cleanText(req.body.email).toLowerCase(), password = String(req.body.password || "");
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Name must contain 2–100 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const [existing] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length) return res.status(409).json({ error: "An account with this email already exists." });
  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.execute("INSERT INTO users (name,email,password_hash) VALUES (?,?,?)", [name,email,hash]);
  req.session.user = { id: result.insertId, name, email };
  res.status(201).json({ user: req.session.user });
}));

app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const email = cleanText(req.body.email).toLowerCase(), password = String(req.body.password || "");
  const [rows] = await pool.execute("SELECT id,name,email,password_hash FROM users WHERE email = ?", [email]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: "Email or password is incorrect." });
  req.session.user = { id: rows[0].id, name: rows[0].name, email: rows[0].email };
  res.json({ user: req.session.user });
}));

app.post("/api/auth/logout", (req, res, next) => {
  req.session.destroy(err => {
    if (err) return next(err);
    res.clearCookie("stockwise.sid");
    res.json({ message: "Logged out." });
  });
});
app.get("/api/auth/me", (req, res) => res.json({ user: req.session.user || null }));

app.get("/api/products", requireAuth, asyncRoute(async (req, res) => {
  const q = cleanText(req.query.q), category = cleanText(req.query.category), status = cleanText(req.query.status);
  const sortMap = { name: "name ASC", quantityAsc: "quantity ASC", quantityDesc: "quantity DESC", valueDesc: "(price * quantity) DESC" };
  const sort = sortMap[req.query.sort] || sortMap.name;
  const conditions = [], params = [];
  if (q) { conditions.push("(name LIKE ? OR sku LIKE ? OR category LIKE ?)"); params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  if (category) { conditions.push("category = ?"); params.push(category); }
  if (status === "out") conditions.push("quantity = 0");
  if (status === "low") conditions.push("quantity > 0 AND quantity <= reorder_level");
  if (status === "in") conditions.push("quantity > reorder_level");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.execute(`SELECT id,name,sku,category,price,quantity,reorder_level,created_at,updated_at FROM products ${where} ORDER BY ${sort}`, params);
  res.json({ products: rows });
}));

app.post("/api/products", requireAuth, asyncRoute(async (req, res) => {
  const v = validateProduct(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  try {
    const p = v.value;
    const [r] = await pool.execute("INSERT INTO products (name,sku,category,price,quantity,reorder_level,created_by) VALUES (?,?,?,?,?,?,?)",
      [p.name,p.sku,p.category,p.price,p.quantity,p.reorder_level,req.session.user.id]);
    const [rows] = await pool.execute("SELECT id,name,sku,category,price,quantity,reorder_level FROM products WHERE id=?", [r.insertId]);
    res.status(201).json({ product: rows[0] });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That SKU already exists." });
    throw e;
  }
}));

app.put("/api/products/:id", requireAuth, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid product ID." });
  const v = validateProduct(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  try {
    const p = v.value;
    const [r] = await pool.execute("UPDATE products SET name=?,sku=?,category=?,price=?,quantity=?,reorder_level=? WHERE id=?",
      [p.name,p.sku,p.category,p.price,p.quantity,p.reorder_level,id]);
    if (!r.affectedRows) return res.status(404).json({ error: "Product not found." });
    const [rows] = await pool.execute("SELECT id,name,sku,category,price,quantity,reorder_level FROM products WHERE id=?", [id]);
    res.json({ product: rows[0] });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "That SKU already exists." });
    throw e;
  }
}));

app.delete("/api/products/:id", requireAuth, asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid product ID." });
  const [r] = await pool.execute("DELETE FROM products WHERE id=?", [id]);
  if (!r.affectedRows) return res.status(404).json({ error: "Product not found." });
  res.json({ message: "Product deleted." });
}));

app.get("/api/dashboard", requireAuth, asyncRoute(async (_req, res) => {
  const [[stats]] = await pool.query(`SELECT COUNT(*) AS total_products,
    COALESCE(SUM(quantity),0) AS total_units,
    COALESCE(SUM(CASE WHEN quantity <= reorder_level THEN 1 ELSE 0 END),0) AS low_stock,
    COALESCE(SUM(price * quantity),0) AS inventory_value FROM products`);
  const [categories] = await pool.query("SELECT category, SUM(quantity) AS units FROM products GROUP BY category ORDER BY units DESC");
  res.json({ stats, categories });
}));

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === "ER_NO_SUCH_TABLE" || err.code === "ECONNREFUSED" || err.code === "ER_BAD_DB_ERROR") {
    return res.status(503).json({ error: "Cannot connect to the database. Check MySQL is running and .env settings are correct." });
  }
  res.status(500).json({ error: "Unexpected server error." });
});

connectDatabase().then(() => app.listen(PORT, () => console.log(`Stockwise running at http://localhost:${PORT}`)))
  .catch(err => { console.error("Database connection failed:", err.message); process.exit(1); });
