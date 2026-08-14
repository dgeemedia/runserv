// apps/backend/src/controllers/inbound.controller.ts
import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

function extractOrgId(toAddress: string): string | null {
  const match = toAddress.match(/^org-([a-zA-Z0-9]+)@/);
  return match ? match[1] : null;
}

export async function handleInboundEmail(req: Request, res: Response) {
  try {
    const toRaw: string = req.body?.to ?? "";
    const fromRaw: string = req.body?.from ?? "";
    const subject: string = req.body?.subject ?? "(no subject)";
    const text: string = req.body?.text ?? "";

    const toAddressMatch = toRaw.match(/<([^>]+)>/);
    const toAddress = toAddressMatch ? toAddressMatch[1] : toRaw.trim();

    const fromAddressMatch = fromRaw.match(/<([^>]+)>/);
    const fromAddress = fromAddressMatch ? fromAddressMatch[1] : fromRaw.trim();

    const orgId = extractOrgId(toAddress);
    if (!orgId) {
      return res.status(200).json({ received: true });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return res.status(200).json({ received: true });
    }

    // Best-effort: match the reply to a known user in this org by email,
    // so the admin panel can attribute the message and offer a one-click
    // reply to the right recipient. If no match is found (e.g. the client
    // replied from a personal address), userId stays null and the admin
    // picks the recipient manually when replying.
    const matchedUser = fromAddress
      ? await prisma.user.findFirst({ where: { orgId, email: fromAddress.toLowerCase() } })
      : null;

    await prisma.emailMessage.create({
      data: {
        orgId,
        userId: matchedUser?.id,
        direction: "INBOUND",
        subject,
        bodyText: text.slice(0, 10000),
        fromAddress: fromAddress || "unknown",
        toAddress,
      },
    });

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[inbound email] failed to process", err);
    return res.status(200).json({ received: true });
  }
}