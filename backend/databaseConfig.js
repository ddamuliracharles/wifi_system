import 'dotenv/config';
import { MongoClient } from 'mongodb';
console.log('MONGO_URI:', process.env.MONGO_URI);

const mongoURI = process.env.MONGO_URI;
const client = new MongoClient(mongoURI);
let db;

async function connectToDatabase() {
    try {
        if (db)return db; // Return existing connection if already connected
        await client.connect();
        console.log('Connected to MongoDB');
         db = client.db('hotspot_db'); // database name
         return db;

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }   
}

export default connectToDatabase;