const express = require("express");
const router = express.Router();
const controller = require("../controllers");

router.get("/events", controller.getEvents);
router.post("/events", controller.createEvent);
router.post("/bookings", controller.createBooking);
router.get("/users/:id/bookings", controller.getUserBookings);
router.post("/events/:id/attendance", controller.markAttendance);

module.exports = router;