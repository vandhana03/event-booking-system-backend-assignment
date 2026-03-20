const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ─── GET UPCOMING EVENTS ────────────────────────────────────────────────────
exports.getEvents = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM events WHERE date >= NOW() ORDER BY date ASC"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getEvents error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// ─── CREATE EVENT ────────────────────────────────────────────────────────────
exports.createEvent = async (req, res) => {
  try {
    const { title, description, date, capacity } = req.body;

    // Input validation
    if (!title || !date || !capacity) {
      return res.status(400).json({
        success: false,
        error: "title, date, and capacity are required fields",
      });
    }
    if (typeof capacity !== "number" || capacity <= 0) {
      return res.status(400).json({
        success: false,
        error: "capacity must be a positive number",
      });
    }
    if (isNaN(Date.parse(date))) {
      return res.status(400).json({
        success: false,
        error: "date must be a valid ISO 8601 datetime string",
      });
    }

    const [result] = await db.query(
      "INSERT INTO events (title, description, date, total_capacity, remaining_tickets) VALUES (?, ?, ?, ?, ?)",
      [title, description || null, date, capacity, capacity]
    );

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      eventId: result.insertId,
    });
  } catch (err) {
    console.error("createEvent error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// ─── BOOK TICKET (with transaction + race condition protection) ──────────────
exports.createBooking = async (req, res) => {
  const { user_id, event_id } = req.body;

  // Input validation
  if (!user_id || !event_id) {
    return res.status(400).json({
      success: false,
      error: "user_id and event_id are required fields",
    });
  }
  if (!Number.isInteger(user_id) || !Number.isInteger(event_id)) {
    return res.status(400).json({
      success: false,
      error: "user_id and event_id must be integers",
    });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Lock the row to prevent race conditions
    const [events] = await connection.query(
      "SELECT * FROM events WHERE id = ? FOR UPDATE",
      [event_id]
    );

    if (!events.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    if (events[0].remaining_tickets <= 0) {
      await connection.rollback();
      return res
        .status(400)
        .json({ success: false, error: "No tickets available for this event" });
    }

    // Verify user exists
    const [users] = await connection.query(
      "SELECT id FROM users WHERE id = ?",
      [user_id]
    );
    if (!users.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const code = uuidv4();

    await connection.query(
      "INSERT INTO bookings (user_id, event_id, booking_code) VALUES (?, ?, ?)",
      [user_id, event_id, code]
    );

    await connection.query(
      "UPDATE events SET remaining_tickets = remaining_tickets - 1 WHERE id = ?",
      [event_id]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Ticket booked successfully",
      booking_code: code,
      event: {
        id: events[0].id,
        title: events[0].title,
        date: events[0].date,
      },
    });
  } catch (err) {
    await connection.rollback();
    console.error("createBooking error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  } finally {
    connection.release();
  }
};

// ─── GET USER BOOKINGS ───────────────────────────────────────────────────────
exports.getUserBookings = async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid user id" });
    }

    // Check user exists
    const [users] = await db.query("SELECT id FROM users WHERE id = ?", [id]);
    if (!users.length) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    const [rows] = await db.query(
      `SELECT b.id, b.booking_code, b.booking_date,
              e.title AS event_title, e.date AS event_date, e.description
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC`,
      [id]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getUserBookings error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// ─── MARK ATTENDANCE & GET TICKET COUNT ─────────────────────────────────────
exports.markAttendance = async (req, res) => {
  try {
    const { code } = req.body;
    const event_id = req.params.id;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, error: "booking code (code) is required" });
    }

    // Lookup booking by code for this event
    const [bookings] = await db.query(
      `SELECT b.id, b.user_id, b.event_id, b.booking_code, b.booking_date,
              u.name AS user_name, u.email AS user_email,
              e.title AS event_title
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       JOIN events e ON b.event_id = e.id
       WHERE b.booking_code = ? AND b.event_id = ?`,
      [code, event_id]
    );

    if (!bookings.length) {
      return res.status(404).json({
        success: false,
        error: "Invalid booking code for this event",
      });
    }

    const booking = bookings[0];

    // Insert attendance record
    await db.query(
      "INSERT INTO attendance (booking_code, user_id) VALUES (?, ?)",
      [code, booking.user_id]
    );

    // Count total tickets booked for this event
    const [countResult] = await db.query(
      "SELECT COUNT(*) AS total_booked FROM bookings WHERE event_id = ?",
      [event_id]
    );

    res.json({
      success: true,
      message: "Attendance marked successfully",
      attendee: {
        user_name: booking.user_name,
        user_email: booking.user_email,
        booking_code: booking.booking_code,
        booking_date: booking.booking_date,
        event_title: booking.event_title,
      },
      total_tickets_booked: countResult[0].total_booked,
    });
  } catch (err) {
    console.error("markAttendance error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};