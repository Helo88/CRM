import { Faq, IFaq } from "../models/Faq";
import { ILocalizedText } from "../models/localizedText";
import type { KbCategorySlug } from "../constants/kb";

/**
 * The one place FAQ mutation logic lives — routes do validation, permission
 * checks, and HTTP shaping only, and never touch `Faq` directly for a
 * write. This is what makes a future system-wide audit log a one-line
 * addition per action rather than a refactor: every function here takes
 * `actorId`, even where it's barely used today.
 */

export interface CreateFaqInput {
  question: ILocalizedText;
  answer: ILocalizedText;
  category: KbCategorySlug;
  actorId: string;
}

export interface UpdateFaqInput {
  question?: ILocalizedText;
  answer?: ILocalizedText;
  category?: KbCategorySlug;
  actorId: string;
}

export async function createFaq(input: CreateFaqInput): Promise<IFaq> {
  return Faq.create({
    question: input.question,
    answer: input.answer,
    category: input.category,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });
}

export async function updateFaq(id: string, input: UpdateFaqInput): Promise<IFaq | null> {
  const faq = await Faq.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!faq) return null;

  if (input.question !== undefined) faq.question = input.question;
  if (input.answer !== undefined) faq.answer = input.answer;
  if (input.category !== undefined) faq.category = input.category;
  faq.updatedBy = input.actorId as unknown as IFaq["updatedBy"];

  await faq.save();
  return faq;
}

export async function softDeleteFaq(id: string, actorId: string): Promise<IFaq | null> {
  const faq = await Faq.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!faq) return null;
  faq.isDeleted = true;
  faq.updatedBy = actorId as unknown as IFaq["updatedBy"];
  await faq.save();
  return faq;
}
