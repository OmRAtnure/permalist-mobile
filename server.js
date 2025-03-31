import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL Database Connection
const db = new pg.Pool({
  user: "postgres",
  host: "localhost",
  database: "permalist",
  password: "postgres",
  port: 5432,
});

// Middleware
app.use(express.json());

// Secret key for JWT
const JWT_SECRET = process.env.JWT_SECRET || "your_secret_key";

// --------------------------------------
// USER REGISTRATION
// --------------------------------------
app.post("/register", async (req, res) => {
  try {
    const { user_id, password, family_code } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.query(
      "INSERT INTO users (user_id, pass, family_code) VALUES ($1, $2, $3) RETURNING *",
      [user_id, hashedPassword, family_code]
    );

    res.status(201).json({ message: "User registered!", user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// USER LOGIN (JWT GENERATION)
// --------------------------------------
app.post("/login", async (req, res) => {
  try {
    const { user_id, password } = req.body;

    const user = await db.query("SELECT * FROM users WHERE user_id = $1", [user_id]);

    if (user.rows.length === 0) return res.status(400).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.rows[0].pass);

    if (!validPassword) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign({ user_id: user_id }, JWT_SECRET, { expiresIn: "2h" });

    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// AUTH MIDDLEWARE (PROTECT ROUTES)
// --------------------------------------
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ message: "Invalid token" });
  }
};

// --------------------------------------
// ADD TASK TO TO-DO LIST
// --------------------------------------
app.post("/tasks", authenticate, async (req, res) => {
  try {
    const { title, time } = req.body;
    const acc = req.user.user_id; // Logged-in user's ID

    const result = await db.query(
      "INSERT INTO items (title, time, acc) VALUES ($1, $2, $3) RETURNING *",
      [title, time, acc]
    );

    res.status(201).json({ message: "Task added", task: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// GET USER'S TO-DO LIST
// --------------------------------------
app.get("/tasks", authenticate, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM items WHERE acc = $1", [req.user.user_id]);

    res.json({ tasks: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// ADD ITEM TO SHARED GROCERY LIST
// --------------------------------------
app.post("/grocery", authenticate, async (req, res) => {
  try {
    const { title } = req.body;
    
    // Get the user's family_code
    const user = await db.query("SELECT family_code FROM users WHERE user_id = $1", [req.user.user_id]);

    if (user.rows.length === 0) return res.status(400).json({ message: "User not found" });

    const family_code = user.rows[0].family_code;

    const result = await db.query(
      "INSERT INTO list (title, family_code, user_id) VALUES ($1, $2, $3) RETURNING *",
      [title, family_code, req.user.user_id]
    );

    res.status(201).json({ message: "Item added to grocery list", item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// GET SHARED GROCERY LIST
// --------------------------------------
app.get("/grocery", authenticate, async (req, res) => {
  try {
    const user = await db.query("SELECT family_code FROM users WHERE user_id = $1", [req.user.user_id]);

    if (user.rows.length === 0) return res.status(400).json({ message: "User not found" });

    const family_code = user.rows[0].family_code;

    const result = await db.query("SELECT * FROM list WHERE family_code = $1", [family_code]);

    res.json({ grocery_list: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// DELETE A TASK FROM TO-DO LIST
// --------------------------------------
app.delete("/tasks/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query("DELETE FROM items WHERE id = $1 AND acc = $2 RETURNING *", [
      id,
      req.user.user_id,
    ]);

    if (result.rows.length === 0) return res.status(404).json({ message: "Task not found" });

    res.json({ message: "Task deleted", task: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// DELETE AN ITEM FROM SHARED GROCERY LIST
// --------------------------------------
app.delete("/grocery/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query("DELETE FROM list WHERE id = $1 RETURNING *", [id]);

    if (result.rows.length === 0) return res.status(404).json({ message: "Item not found" });

    res.json({ message: "Item deleted", item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------------------
// START SERVER
// --------------------------------------
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
