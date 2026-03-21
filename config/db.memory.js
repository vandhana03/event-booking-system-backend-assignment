class InMemoryDB {
  constructor() {
    this.events = [];
    this.users = [
      { id: 1, name: "Test User", email: "test@example.com" },
      { id: 2, name: "Another User", email: "user2@example.com" }
    ];
    this.bookings = [];
    this.attendance = [];

    this.eventIds = 1;
    this.bookingIds = 1;
    this.attendanceIds = 1;
  }

  async query(sql, params = []) {
    const normalizedSql = sql.trim().replace(/\s+/g, " ");

    if (normalizedSql.includes("SELECT * FROM events WHERE date >= NOW() ORDER BY date ASC")) {
      const now = new Date();
      const rows = this.events
        .filter(e => new Date(e.date) >= now)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      return [rows];
    }

    if (normalizedSql.includes("INSERT INTO events (title, description, date, total_capacity, remaining_tickets) VALUES (?, ?, ?, ?, ?)")) {
      const [title, description, date, total_capacity, remaining_tickets] = params;
      const id = this.eventIds++;
      this.events.push({ id, title, description, date, total_capacity, remaining_tickets });
      return [{ insertId: id }];
    }

    if (normalizedSql.includes("SELECT * FROM events WHERE id = ? FOR UPDATE")) {
      const [id] = params;
      const rows = this.events.filter(e => e.id === Number(id));
      return [rows];
    }

    if (normalizedSql.includes("SELECT id FROM users WHERE id = ?")) {
      const [id] = params;
      const rows = this.users.filter(u => u.id === Number(id)).map(u => ({ id: u.id }));
      return [rows];
    }

    if (normalizedSql.includes("INSERT INTO bookings (user_id, event_id, booking_code) VALUES (?, ?, ?)")) {
      const [user_id, event_id, booking_code] = params;
      const id = this.bookingIds++;
      this.bookings.push({ id, user_id, event_id, booking_code, booking_date: new Date().toISOString() });
      return [{ insertId: id }];
    }

    if (normalizedSql.includes("UPDATE events SET remaining_tickets = remaining_tickets - 1 WHERE id = ?")) {
      const [id] = params;
      const event = this.events.find(e => e.id === Number(id));
      if (event) {
        event.remaining_tickets -= 1;
      }
      return [{}];
    }

    if (normalizedSql.includes("FROM bookings b JOIN events e ON b.event_id = e.id WHERE b.user_id = ? ORDER BY b.booking_date DESC")) {
      const [user_id] = params;
      const rows = this.bookings
        .filter(b => b.user_id === Number(user_id))
        .map(b => {
          const e = this.events.find(ev => ev.id === b.event_id) || {};
          return {
            id: b.id,
            booking_code: b.booking_code,
            booking_date: b.booking_date,
            event_title: e.title,
            event_date: e.date,
            description: e.description
          };
        })
        .sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
      return [rows];
    }

    if (normalizedSql.includes("WHERE b.booking_code = ? AND b.event_id = ?")) {
      const [booking_code, event_id] = params;
      const rows = this.bookings
        .filter(b => b.booking_code === booking_code && b.event_id === Number(event_id))
        .map(b => {
          const u = this.users.find(us => us.id === b.user_id) || {};
          const e = this.events.find(ev => ev.id === b.event_id) || {};
          return {
            id: b.id,
            user_id: b.user_id,
            event_id: b.event_id,
            booking_code: b.booking_code,
            booking_date: b.booking_date,
            user_name: u.name,
            user_email: u.email,
            event_title: e.title
          };
        });
      return [rows];
    }

    if (normalizedSql.includes("INSERT INTO attendance (booking_code, user_id) VALUES (?, ?)")) {
      const [booking_code, user_id] = params;
      const id = this.attendanceIds++;
      this.attendance.push({ id, booking_code, user_id, entry_time: new Date().toISOString() });
      return [{ insertId: id }];
    }

    if (normalizedSql.includes("SELECT COUNT(*) AS total_booked FROM bookings WHERE event_id = ?")) {
      const [event_id] = params;
      const count = this.bookings.filter(b => b.event_id === Number(event_id)).length;
      return [[{ total_booked: count }]];
    }

    console.warn(`[In-Memory DB] Unhandled query: ${normalizedSql}`);
    return [[]]; // Default empty response
  }

  async getConnection() {
    return {
      query: this.query.bind(this),
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {}
    };
  }
}

const pool = new InMemoryDB();
module.exports = pool;
