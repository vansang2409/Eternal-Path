// Filesystem persistence for the player mailbox (Sprint 201).
//
// Mirrors MarketStore's debounced-flush pattern. Holds per-recipient mail
// (gold + message) delivered even when the recipient is offline; claimed on
// demand from the mailbox panel.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { MailMessage } from "@mmorpg/shared";

const MAIL_SAVE_PATH = process.env.MAIL_SAVE_PATH || "data/mail.json";
const FLUSH_INTERVAL_MS = 30 * 1000;
const MAX_MAIL_PER_BOX = 50;

const boxes = new Map<string, MailMessage[]>();
let dirty = false;
let timer: NodeJS.Timeout | undefined;

function loadFromDisk(): void {
  try {
    if (!existsSync(MAIL_SAVE_PATH)) return;
    const raw = readFileSync(MAIL_SAVE_PATH, "utf8");
    const json = JSON.parse(raw) as { boxes?: Record<string, MailMessage[]> };
    if (json.boxes) {
      for (const [name, mails] of Object.entries(json.boxes)) {
        if (Array.isArray(mails)) boxes.set(name, mails);
      }
    }
    console.log(`[mail-store] Loaded ${boxes.size} mailboxes from ${MAIL_SAVE_PATH}`);
  } catch (err) {
    console.warn(`[mail-store] Failed to load ${MAIL_SAVE_PATH}:`, err);
  }
}

function flushToDisk(): void {
  if (!dirty) return;
  try {
    const dir = dirname(MAIL_SAVE_PATH);
    if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(MAIL_SAVE_PATH, JSON.stringify({ boxes: Object.fromEntries(boxes) }), "utf8");
    dirty = false;
  } catch (err) {
    console.warn(`[mail-store] Failed to write ${MAIL_SAVE_PATH}:`, err);
  }
}

loadFromDisk();
if (!timer) {
  timer = setInterval(flushToDisk, FLUSH_INTERVAL_MS);
  timer.unref?.();
}
process.on("beforeExit", flushToDisk);

export const mailStore = {
  /** Returns true if delivered; false if the recipient's box is full. */
  send(mail: MailMessage): boolean {
    const box = boxes.get(mail.to) ?? [];
    if (box.length >= MAX_MAIL_PER_BOX) return false;
    box.push(mail);
    boxes.set(mail.to, box);
    dirty = true;
    return true;
  },
  getFor(accountName: string): MailMessage[] {
    return [...(boxes.get(accountName) ?? [])].sort((a, b) => b.sentAt - a.sentAt);
  },
  countFor(accountName: string): number {
    return boxes.get(accountName)?.length ?? 0;
  },
  /** Remove and return a single mail (claim). */
  claim(accountName: string, mailId: string): MailMessage | undefined {
    const box = boxes.get(accountName);
    if (!box) return undefined;
    const idx = box.findIndex((m) => m.id === mailId);
    if (idx < 0) return undefined;
    const [mail] = box.splice(idx, 1);
    if (box.length === 0) boxes.delete(accountName); else boxes.set(accountName, box);
    dirty = true;
    return mail;
  },
  flushNow(): void { flushToDisk(); }
};
