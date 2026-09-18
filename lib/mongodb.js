import { MongoClient } from 'mongodb';
let client;
export async function itemsCollection() { if (!client) { client = new MongoClient(process.env.MONGODB_URI); await client.connect(); } const collection = client.db('pricepocket').collection('items'); await collection.createIndex({ name: 1 }); return collection; }
