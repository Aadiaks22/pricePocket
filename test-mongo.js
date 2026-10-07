const { MongoClient } = require('mongodb');

// Try connecting to a single node directly without SRV
const uri = 'mongodb://adityaaks220:K2r2n321@codewithaadi-shard-00-00.dqds4.mongodb.net:27017/?tls=true';

async function run() {
  console.log("Attempting to connect...");
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000
  });
  
  try {
    await client.connect();
    console.log("Connected successfully to node!");
    const status = await client.db('admin').command({ replSetGetStatus: 1 });
    console.log("Replica Set Name:", status.set);
  } catch (err) {
    console.error("Connection failed:");
    console.error(err.message);
  } finally {
    await client.close();
  }
}
run();
