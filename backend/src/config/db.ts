import mongoose from "mongoose";

export async function connectDB(): Promise<typeof mongoose.connection> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy backend/.env.example to backend/.env and fill it in.");
  }

  mongoose.connection.on("connected", () => {
    console.log("[db] connected to MongoDB");
  });
  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", (err as Error).message);
  });

  await mongoose.connect(uri);
  return mongoose.connection;
}
