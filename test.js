// Import required modules
import express from 'express';
import pg from 'pg';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
const port = 3000;
const SECRET_KEY = 'your_secret_key'; // Change this in production
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new pg.Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'permalist',
  password: 'postgres@31',
  port: 5432,
});

// *** USER REGISTRATION ***
app.post("/register", async (req, res) => {
    console.log('in the register');
  const { user_id, password, family_code } = req.body;

  if (!user_id || !password) {
    return res.status(400).json({ error: "User ID and password are required" });
  }

  try {
    // Check if user already exists
    const userExists = await pool.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Hash the password before storing it
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const result = await pool.query(
      "INSERT INTO users (user_id, pass, family_code) VALUES ($1, $2, $3) RETURNING user_id",
      [user_id, hashedPassword, family_code || null] // Store family_code if provided
    );

    // Generate a JWT token
    const token = jwt.sign({ user_id: result.rows[0].user_id }, JWT_SECRET, { expiresIn: "1h" });

    res.status(201).json({ message: "User registered successfully", token });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// User Login
app.post('/login', async (req, res) => {
  const { user_id, password } = req.body;
  //console.log('here');
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [user_id]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });
    
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.pass);
    if (!match) return res.status(401).json({ error: 'Invalid password' });
    
    const token = jwt.sign({ user_id: user.user_id }, SECRET_KEY, { expiresIn: '1h' });
    //console.log(token);
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to verify JWT
// function authenticateToken(req, res, next) {
//     console.log('in the auth');
//   const token = req.headers['authorization'];
//   if (!token) return res.status(401).json({ error: 'Unauthorized' });

//   jwt.verify(token, SECRET_KEY, (err, user) => {
//     if (err) return res.status(403).json({ error: 'Forbidden' });
//     req.user = user;
//     next();
//   });
// }

function authenticateToken(req, res, next) {
   // console.log("🔵 authenticateToken called");

    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        console.log("🔴 No Authorization header provided");
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    //console.log("🟢 Authorization header received:", authHeader);

    const token = authHeader.split(" ")[1];
    if (!token) {
        console.log("🔴 No token found after 'Bearer'");
        return res.status(401).json({ error: "Unauthorized: Invalid token format" });
    }

    //console.log("🟢 Token extracted:", token);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log("🔴 JWT Verification failed:", err.message);
            return res.status(403).json({ error: "Forbidden: Invalid token" });
        }

        //console.log("🟢 JWT Verified! User:", user);
        req.user = user;  // Storing user data in request
        next();
    });
}


//Fetch Tasks
// app.get('/tasks', authenticateToken, async (req, res) => {
//     console.log('in task');
//   try {
//     console.log("userid:"+req.user.user_id);
//     const result = await pool.query('SELECT * FROM items WHERE acc = $1', [req.user.user_id]);
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: 'Server error' });
//   }
// });


app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const time = req.query.time;
    const userId = req.user.user_id;
    console.log(userId);
    console.log(time);
    // let query = 'SELECT * FROM items WHERE acc = $1 AND time = $2';
        let query = 'SELECT * FROM items WHERE acc = $1 AND time = $2 ORDER BY id ASC'; 
    let values = [userId, time];

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.delete('/tasks/:id', async (req, res) => {
    console.log('in the delete route');
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM items WHERE id = $1', [id]);
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

app.post('/tasks', authenticateToken, async (req, res) => {
    try {
        const { title, time } = req.body;
        const userId = req.user.user_id;
        
        if (!title || !time) {
            return res.status(400).json({ error: 'Title and time are required' });
        }
        
        const result = await pool.query(
            'INSERT INTO items (title, time, acc) VALUES ($1, $2, $3) RETURNING *',
            [title, time, userId]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ error: 'Failed to add task' });
    }
});

// Edit Task
app.put('/tasks/:id', authenticateToken, async (req, res) => {
    console.log("in the edit route");
    try {
        const { id } = req.params;
        const { title, time } = req.body;
        const userId = req.user.user_id;
        console.log(title);
        console.log(time);
        if (!title || !time) {
            console.log("first error");
            return res.status(400).json({ error: 'Title and time are required' });
        }

        // Check if the task exists and belongs to the user
        const taskCheck = await pool.query('SELECT * FROM items WHERE id = $1 AND acc = $2', [id, userId]);
        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found or not owned by user' });
        }

        // Update the task
        const result = await pool.query(
            'UPDATE items SET title = $1, time = $2 WHERE id = $3 RETURNING *',
            [title, time, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});





app.listen(port, () => console.log(`Server running on port ${port}`));
