import { clerkClient } from "@clerk/express";
import { prisma } from "@firstloop/db";

export async function getOrCreateUser(clerkId: string) {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const clerkUser = await clerkClient.users.getUser(clerkId);
  const email =
    clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error(`Clerk user ${clerkId} has no email address on file`);
  }

  return prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: { clerkId, email },
  });
}
