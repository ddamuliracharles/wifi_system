// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('hotspot_db');

// Create a new document in the collection.
db.getCollection('vouchers').insertMany(
    [
        {
            "bytes-in": "0",
            "bytes-out": "0",
            "comment": "vc-912-08.05.25-24hours05/08/2025",
            "disabled": "false",
            "limit-uptime": "",
            "name": "jm25",
            "packets-in": "0",
            "packets-out": "0",
            "password": "jm25",
            "profile": "24-hours",
            "uptime": "0s",
            "status": "active"
        },
        {
            "bytes-in": "0",
            "bytes-out": "0",
            "comment": "vc-912-08.05.26-24hours06/08/2025",
            "disabled": false,
            "limit-uptime": "",
            "name": "jm26",
            "packets-in": 0,
            "packets-out": 0,
            "password": "jm26",
           "profile" : "24-hours",
            "uptime": "0s",
            "status": "active"

        },

            {
            "bytes-in": "0",
            "bytes-out": "0",
            "comment": "vc-912-08.05.27-24hours07/08/2025",
            "disabled": false,
            "limit-uptime": "",
            "name": "jm27",
            "packets-in": 0,
            "packets-out": 0,
            "password": "jm27",
           "profile" : "24-hours",
            "uptime": "0s",
            "status": "active"
        }
    ]
);

