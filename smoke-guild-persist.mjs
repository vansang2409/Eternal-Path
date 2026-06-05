// Persistence check: create guild, wait for 30s flush, verify file exists.
// Phase 2 (RESTORE=1): reconnect same account, expect guildUpdate with same tag.
import { io } from "socket.io-client";
const PORT = process.env.PORT || "3177";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (s, ev, t = 8000) => new Promise((res, rej) => {
  const h = setTimeout(() => rej(new Error("timeout " + ev)), t);
  s.once(ev, (p) => { clearTimeout(h); res(p); });
});
const connect = () => new Promise((res, rej) => {
  const s = io(`http://localhost:${PORT}`, { transports: ["websocket"] });
  s.on("connect", () => res(s)); s.on("connect_error", rej);
});

const email = "persist_guild@t.vn";
const name = "PersistChief";

if (process.env.RESTORE === "1") {
  const s = await connect();
  s.emit("login", { email, accountName: name, password: "test1234" });
  await once(s, "player");
  const view = await once(s, "guildUpdate");
  console.log(view && view.tag === "PS" && view.members[0].accountName === name ? "RESTORE PASS" : "RESTORE FAIL " + JSON.stringify(view));
  s.disconnect();
  process.exit(0);
} else {
  const s = await connect();
  s.emit("login", { email, accountName: name, password: "test1234" });
  await once(s, "player");
  s.emit("devGrant", { gold: 10000 });
  await once(s, "player");
  s.emit("createGuild", { name: "Persist Sect", tag: "PS" });
  await once(s, "guildUpdate");
  console.log("created, waiting 32s for flush...");
  await sleep(32000);
  s.disconnect();
  process.exit(0);
}
