const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;

beforeAll(async () => {
  // Use in-memory MongoDB to avoid reliance on network/atlas clusters during tests
  mongoServer = await MongoMemoryServer.create();
  const testUri = mongoServer.getUri();
  await mongoose.connect(testUri);
}, 30000);

afterEach(async () => {
  // Wipe all collections after each test — every test starts fresh
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    if (collections[key]) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});
