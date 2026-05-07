// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('hotspot_db');


// Create a new document in the collection.
db.createCollection('users');
db.getCollection('users').insertOne({


  "email": "user@example.com",
  "password": "$2a$10$hashed_password_here", // bcrypt hash
  "name": "John Doe",
  "createdAt": ISODate("2026-02-24T10:30:00Z"),
  "updatedAt": ISODate("2026-02-24T10:30:00Z"),
  "status": "active",
"routers": [
    {
      "routerId": 1234,
      "name": "Main Router"

    }
  ],
  "settings": {
    "notifications": true,
    "timezone": "Asia/Singapore"
  }

});