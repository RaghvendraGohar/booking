Room Booking API 

live service : https://booking-846k.onrender.com

A REST API built using Node.js, Express.js, and MongoDB (Mongoose) for creating rooms, checking room availability, booking rooms, and cancelling bookings.

Tech Stack

Node.js

Express.js

MongoDB

Mongoose

dotenv

Nodemon

Features

Create rooms with name and capacity.

List available rooms for a requested time range and capacity.

Book rooms for a specific time range.

Prevent overlapping active bookings.

Cancel bookings belonging to the authenticated user.

Validate room IDs, booking IDs, capacity, and dates.

Health-check endpoint.

API Endpoints

Method

Endpoint

Description

GET

/health

Check API status

POST

/rooms

Create a room

GET

/rooms/free

Find available rooms

POST

/bookings

Book a room

DELETE

/bookings/:id

Cancel a booking

For JSON requests, select Body → raw → JSON in Postman.

5. Test 1 — Health Check

Method: GET

URL:

http://localhost:3000/health

No request body or authentication header is required.

Expected response — 200 OK:

{
  "success": true,
  "message": "Room Booking API is running"
}

6. Test 2 — Create a Room

Method: POST

URL:

http://localhost:3000/rooms

Request body:

{
  "name": "Conference Room A",
  "capacity": 10
}

Expected response — 201 Created:

{
  "id": "REPLACE_WITH_GENERATED_ID",
  "name": "Conference Room A",
  "capacity": 10
}

Save the generated id as ROOM_ID. You will need it to create a booking.

Find Available Rooms

Method: GET

url : http://localhost:3000/rooms/free?start_time=2027-01-15T10:00:00.000Z&end_time=2027-01-15T11:00:00.000Z&capacity=5

This request searches for rooms that can accommodate at least five people and have no overlapping active bookings during the specified period.

Expected response — 200 OK:

[
  {
    "id": "ROOM_ID",
    "name": "Conference Room A",
    "capacity": 10
  }
]

The response may be an empty array if no rooms match.


Test 4 — Book a Room

Method: POST

URL:

http://localhost:3000/bookings

Headers:

Content-Type: application/json
x-user-id: user123

The x-user-id header simulates authentication for development purposes.

Request body:

{
  "room_id": "ROOM_ID",
  "start_time": "2027-01-15T10:00:00.000Z",
  "end_time": "2027-01-15T11:00:00.000Z"
}

Replace ROOM_ID with the actual ID returned by the Create Room endpoint.

Expected response — 201 Created:

{
  "id": "GENERATED_BOOKING_ID",
  "room_id": "ROOM_ID",
  "user_id": "user123",
  "start_time": "2027-01-15T10:00:00.000Z",
  "end_time": "2027-01-15T11:00:00.000Z",
  "status": "active"
}

Save the returned booking id as BOOKING_ID.


Test 5 — Cancel a Booking

Method: DELETE

URL:

http://localhost:3000/bookings/BOOKING_ID

Replace BOOKING_ID with the actual booking ID.

Headers:

x-user-id: user123

The user ID must match the ID used when creating the booking.

Expected response — 200 OK:

{
  "message": "Booking successfully cancelled."
}

Cancellation updates the booking status to cancelled; it does not physically delete the document.

