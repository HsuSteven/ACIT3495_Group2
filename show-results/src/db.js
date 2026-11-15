const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DATABASE || "db";
const collectionName = process.env.MONGO_COLLECTION || "grade_analytics";

async function fetchMongoData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    return await collection.find({}).toArray();
  } catch (error) {
    console.error("There was an error fetching data from mongoDB", error);
    return [];
  } finally {
    await client.close();
  }
}

module.exports = { fetchMongoData };