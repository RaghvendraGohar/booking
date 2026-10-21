
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";

import Room from "./models/rooms.js";
import Booking from "./models/Booking.js";

const app = express();

app.use(express.json());

// Middleware to extract user ID (mock authentication via header)
const requireUser = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (typeof userId !== "string" || !userId.trim()) {
    return res.status(401).json({
      error: "Unauthorized: Missing x-user-id header",
    });
  }

  req.userId = userId.trim();
  next();
};

// 1. Create a Room
app.post("/rooms", async (req, res) => {
  try {
    const { name, capacity } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      capacity === undefined ||
      capacity === null ||
      capacity === "" ||
      !Number.isInteger(Number(capacity)) ||
      Number(capacity) <= 0
    ) {
      return res.status(400).json({
        error: "Invalid input: Name and positive capacity are required.",
      });
    }

    const room = await Room.create({
      name: name.trim(),
      capacity: Number(capacity),
    });

    return res.status(201).json({
      id: room._id.toString(),
      name: room.name,
      capacity: room.capacity,
    });
  } catch (error) {
    console.error("Create room error:", error.message);

    return res.status(500).json({
      error: "Failed to create room.",
    });
  }
});

// 2. List Free Rooms for a given time range and capacity
app.get("/rooms/free", async (req, res) => {
  try {
    const { start_time, end_time, capacity } = req.query;

    if (!start_time || !end_time || capacity === undefined) {
      return res.status(400).json({
        error:
          "Missing required query parameters: start_time, end_time, capacity",
      });
    }

    const requestedCapacity = Number(capacity);
    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (
      !Number.isInteger(requestedCapacity) ||
      requestedCapacity <= 0
    ) {
      return res.status(400).json({
        error: "Capacity must be a positive number.",
      });
    }

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid date format.",
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        error: "End time must be after start time.",
      });
    }

    // Find rooms that can accommodate the requested capacity.
    const rooms = await Room.find({
      capacity: { $gte: requestedCapacity },
    }).lean();

    if (rooms.length === 0) {
      return res.json([]);
    }

    // Find active bookings that overlap the requested time range.
    const conflictingBookings = await Booking.find({
      room_id: { $in: rooms.map((room) => room._id) },
      status: "active",
      start_time: { $lt: endDate },
      end_time: { $gt: startDate },
    })
      .select("room_id")
      .lean();

    const bookedRoomIds = new Set(
      conflictingBookings.map((booking) =>
        booking.room_id.toString()
      )
    );

    const freeRooms = rooms
      .filter((room) => !bookedRoomIds.has(room._id.toString()))
      .map((room) => ({
        id: room._id.toString(),
        name: room.name,
        capacity: room.capacity,
      }));

    return res.json(freeRooms);
  } catch (error) {
    console.error("Find free rooms error:", error.message);

    return res.status(500).json({
      error: "Failed to find available rooms.",
    });
  }
});

// 3. Book a Room
app.post("/bookings", requireUser, async (req, res) => {
  try {
    const { room_id, start_time, end_time } = req.body;
    const userId = req.userId;

    if (!room_id || !start_time || !end_time) {
      return res.status(400).json({
        error: "Missing room_id, start_time, or end_time.",
      });
    }

    // Validate MongoDB ObjectId.
    if (!mongoose.isValidObjectId(room_id)) {
      return res.status(400).json({
        error: "Invalid room ID.",
      });
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);
    const now = new Date();

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return res.status(400).json({
        error: "Invalid date format.",
      });
    }

    if (startDate < now) {
      return res.status(400).json({
        error: "Booking times must be in the future.",
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        error: "End time must be after start time.",
      });
    }

    // Verify that the room exists.
    const room = await Room.findById(room_id);

    if (!room) {
      return res.status(404).json({
        error: "Room not found.",
      });
    }

    // Check for overlapping active bookings.
    const existingBooking = await Booking.findOne({
      room_id: room._id,
      status: "active",
      start_time: { $lt: endDate },
      end_time: { $gt: startDate },
    });

    if (existingBooking) {
      return res.status(400).json({
        error: "Room is already booked for this time range.",
      });
    }

    // Create the booking.
    const booking = await Booking.create({
      room_id: room._id,
      user_id: userId,
      start_time: startDate,
      end_time: endDate,
      status: "active",
    });

    return res.status(201).json({
      id: booking._id.toString(),
      room_id: booking.room_id.toString(),
      user_id: booking.user_id,
      start_time: booking.start_time,
      end_time: booking.end_time,
      status: booking.status,
    });
  } catch (error) {
    console.error("Create booking error:", error.message);

    return res.status(500).json({
      error: "Failed to create booking.",
    });
  }
});

// 4. Cancel a Booking
app.delete("/bookings/:id", requireUser, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = req.userId;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(404).json({
        error: "Booking not found or unauthorized.",
      });
    }

    // Only find bookings belonging to this user.
    const booking = await Booking.findOne({
      _id: bookingId,
      user_id: userId,
      status: "active",
    });

    if (!booking) {
      return res.status(404).json({
        error: "Booking not found or unauthorized.",
      });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.json({
      message: "Booking successfully cancelled.",
    });
  } catch (error) {
    console.error("Cancel booking error:", error.message);

    return res.status(500).json({
      error: "Failed to cancel booking.",
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Room Booking API is running",
  });
});

// Start server when this file is executed directly.
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

// ES module equivalent of require.main === module
import { pathToFileURL } from "node:url";

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer();
}

export default app;
