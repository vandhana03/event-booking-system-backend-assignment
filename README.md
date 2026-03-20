# Event Booking API

A **Mini Event Management System** built with **Node.js (Express)** and **MySQL**. Users can browse upcoming events, book tickets, and manage attendance — all via a RESTful API documented with OpenAPI / Swagger.

---

## Features

- List upcoming events
- Create new events
- Book tickets with **race condition protection** (MySQL transactions + `SELECT FOR UPDATE`)
- Unique booking code (UUID) issued per booking
- Retrieve all bookings for a user
- Mark event attendance with booking code, returns total tickets booked
- Full OpenAPI 3.0 documentation (Swagger UI)

---

## Tech Stack

| Layer       | Technology              |
|-------------|-------------------------|
| Runtime     | Node.js                 |
| Framework   | Express.js              |
| Database    | MySQL 8+                |
| ORM/Driver  | mysql2 (promise-based)  |
| API Docs    | swagger-ui-express + YAML |
| Unique IDs  | uuid (v4)               |
| Config      | dotenv                  |

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or above
- [MySQL](https://dev.mysql.com/downloads/) 8.0 or above
- npm (comes with Node.js)

---

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/event-booking.git
cd event-booking
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example env file and fill in your MySQL credentials:

```bash
cp .env.example .env
```

Open `.env` and set:

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=event_db
```

### 4. Set Up the Database

Log into MySQL and run the schema file:

```bash
mysql -u root -p < schema.sql
```

Or inside the MySQL shell:

```sql
SOURCE /path/to/schema.sql;
```

This will:
- Create the `event_db` database
- Create all four tables: `users`, `events`, `bookings`, `attendance`

### 5. Run the Server

**Production:**
```bash
npm start
```

**Development (with auto-reload):**
```bash
npm run dev
```

The server starts on `http://localhost:3000` (or the `PORT` in your `.env`).

---

## API Documentation

Interactive Swagger UI is available at:

```
http://localhost:3000/api-docs
```

---

## API Endpoints

| Method | Endpoint                   | Description                                      |
|--------|----------------------------|--------------------------------------------------|
| GET    | `/api/events`              | List all upcoming events                         |
| POST   | `/api/events`              | Create a new event                               |
| POST   | `/api/bookings`            | Book a ticket (returns unique booking code)      |
| GET    | `/api/users/:id/bookings`  | Get all bookings for a specific user             |
| POST   | `/api/events/:id/attendance` | Mark attendance with booking code              |

---

## Example Requests

### Create a User (directly via SQL — no user endpoint needed for the task)
```sql
INSERT INTO users (name, email) VALUES ('Alice Smith', 'alice@example.com');
```

### Create an Event
```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Tech Conference","description":"An annual event","date":"2026-04-15T09:00:00Z","capacity":100}'
```

### Book a Ticket
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"event_id":1}'
```

### Get User Bookings
```bash
curl http://localhost:3000/api/users/1/bookings
```

### Mark Attendance
```bash
curl -X POST http://localhost:3000/api/events/1/attendance \
  -H "Content-Type: application/json" \
  -d '{"code":"550e8400-e29b-41d4-a716-446655440000"}'
```

---

## Project Structure

```
event_booking/
├── app.js                    # Express app entry point
├── schema.sql                # MySQL schema (auto-imported by Docker)
├── swagger.yaml              # OpenAPI 3.0 specification
├── Dockerfile                # Multi-stage Docker image
├── docker-compose.yml        # One-click stack (API + MySQL)
├── .dockerignore
├── .env.example              # Environment variable template
├── package.json
├── postman_collection.json   # Postman collection
├── config/
│   └── db.js                 # MySQL connection pool (uses dotenv)
├── controllers/
│   └── index.js              # Business logic for all routes
└── routes/
    └── index.js              # Route definitions
```

---

## Race Condition Handling

Ticket booking uses a **MySQL transaction with row-level locking**:

```sql
BEGIN;
SELECT * FROM events WHERE id = ? FOR UPDATE;  -- locks the row
-- check remaining_tickets > 0
INSERT INTO bookings ...;
UPDATE events SET remaining_tickets = remaining_tickets - 1 ...;
COMMIT;
```

This ensures that even under concurrent requests, no event is over-booked.

---

## Postman Collection

Import `postman_collection.json` from the project root into Postman to test all endpoints with pre-filled examples.

---

## 🐳 Docker — One-Click Deployment

Docker Compose spins up **both the Node.js API and MySQL 8** with a single command. The schema is imported automatically on first boot.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker + Compose)

### Steps

**1. Copy and configure environment file**
```bash
cp .env.example .env
```
Open `.env` and set your values:
```env
PORT=3000
DB_HOST=db
DB_USER=eventuser
DB_PASSWORD=strongpassword123
DB_NAME=event_db
```
> ⚠️ `DB_HOST` must be `db` (the Docker service name) — **not** `localhost`.

**2. Build and start everything**
```bash
docker compose up --build
```
This will:
- Pull the MySQL 8 image
- Build the Node.js API image
- Wait for MySQL to be healthy before starting the API
- Import `schema.sql` automatically on first run

**3. Visit your API**

| URL | Purpose |
|-----|---------|
| `http://localhost:3000/api/events` | REST API |
| `http://localhost:3000/api-docs` | Swagger UI |

**Stop the stack:**
```bash
docker compose down
```

**Stop and delete all data (fresh start):**
```bash
docker compose down -v
```

**Rebuild after code changes:**
```bash
docker compose up --build
```


