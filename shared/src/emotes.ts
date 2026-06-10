// Sprint 245: social emotes + dice roll. The whitelist keeps the wire format
// tiny and the client bubble rendering safe.

export interface EmoteDef {
  id: string;
  icon: string;
  /** Vietnamese verb used in the chat line. */
  label: string;
}

export const EMOTES: EmoteDef[] = [
  { id: "dance", icon: "💃", label: "nhảy múa" },
  { id: "wave", icon: "👋", label: "vẫy tay chào" },
  { id: "laugh", icon: "😂", label: "cười lớn" },
  { id: "cry", icon: "😭", label: "khóc nức nở" },
  { id: "heart", icon: "❤️", label: "thả tim" }
];

export function getEmote(id: string): EmoteDef | undefined {
  return EMOTES.find((e) => e.id === id);
}

export const ROLL_COOLDOWN_MS = 3_000;
export const EMOTE_COOLDOWN_MS = 2_000;
