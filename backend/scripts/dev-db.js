// TEMPORARY local-testing helper — not part of the app. Starts an in-memory
// MongoDB instance (via mongodb-memory-server) and prints its connection URI,
// since no real MongoDB is installed on this machine. Remove once a real
// MongoDB (local install, Docker, or Atlas) is available.
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongod = await MongoMemoryServer.create({
    instance: { dbName: "azmsquad_customer_service" },
  });
  const uri = mongod.getUri("azmsquad_customer_service");
  console.log("MONGODB_URI=" + uri);
  console.log("[dev-db] in-memory MongoDB running — keep this process open while testing.");

  process.on("SIGINT", async () => {
    await mongod.stop();
    process.exit(0);
  });
})();
