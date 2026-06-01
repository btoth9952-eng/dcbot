import { Client, GatewayIntentBits } from "discord.js";
import express from "express";
import fetch from "node-fetch";

const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

// BOT
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// WEB SERVER (Railway miatt kell)
const app = express();
app.use(express.json());

// invite map: code -> username
const inviteMap = new Map();

// -------------------------
// BOT READY
// -------------------------
client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);
});

// -------------------------
// INVITE GENERÁLÁS API
// -------------------------
app.get("/create-invite", async (req, res) => {
  try {
    const username = req.query.user;

    if (!username) {
      return res.send("NO USER");
    }

    const guild = client.guilds.cache.first();
    if (!guild) return res.send("NO GUILD");

    const channel = guild.channels.cache.find(c => c.isTextBased());
    if (!channel) return res.send("NO CHANNEL");

    const invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 1,
      unique: true
    });

    inviteMap.set(invite.code, username);

    res.send(`https://discord.gg/${invite.code}`);
  } catch (err) {
    console.error(err);
    res.send("ERROR");
  }
});

// -------------------------
// INVITE TRACKING
// -------------------------
client.on("guildMemberAdd", async (member) => {
  try {
    const newInvites = await member.guild.invites.fetch();

    const used = newInvites.find(inv => inviteMap.has(inv.code));

    if (!used) return;

    const username = inviteMap.get(used.code);

    console.log(`Invite: ${username} → +5 pont`);

    await fetch(
      `https://kasziradar.hu/api/add_points.php?user=${username}&points=5&secret=MY_SECRET`
    );

    inviteMap.delete(used.code);
  } catch (err) {
    console.error("Invite error:", err);
  }
});

// -------------------------
// START SERVER + BOT
// -------------------------
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

client.login(TOKEN);
