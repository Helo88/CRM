import mongoose, { Schema } from "mongoose";

interface ICounter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model<ICounter>("Counter", counterSchema);

// Atomic per-name sequence — used to mint each user's membershipNumber
// (see User.ts's pre-save hook) without a generate-then-check-uniqueness
// retry loop.
export async function nextSequence(name: string): Promise<number> {
  const result = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result!.seq;
}
