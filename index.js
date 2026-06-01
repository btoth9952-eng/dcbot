import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;

// invite cache
let invites = new Map();

async function loadInvites(guild) {
  const guildInvites = await guild.invites.fetch();
  invites.set(
    guild.id,
    new Map(guildInvites.map(inv => [inv.code, inv.uses]))
  );
}

client.on("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);

  client.guilds.cache.forEach(guild => {
    loadInvites(guild);
  });
});

// invite figyelés
client.on("guildMemberAdd", async member => {
  const newInvites = await member.guild.invites.fetch();
  const oldInvites = invites.get(member.guild.id);

  const used = newInvites.find(inv =>
    (oldInvites.get(inv.code) || 0) < inv.uses
  );

  if (!used) return;

  const inviter = used.inviter;

  console.log(`Invite: ${inviter.username} → +5 pont`);

  // PHP hívás
  fetch(`https://kasziradar.hu/api/add_points.php?user=${inviter.username}&points=5&secret=MY_SECRET`);

  invites.set(
    member.guild.id,
    new Map(newInvites.map(inv => [inv.code, inv.uses]))
  );
});

client.login(TOKEN);

⚡ 1. BOT – INVITE GENERÁLÁS (EGYBEN MEGY)

Tedd be a botodba ezt:

🔥 index.js-hez (ÚJ RÉSZ)
import express from "express";

const app = express();
app.use(express.json());

let inviteMap = new Map(); 
// code -> username

app.get("/create-invite", async (req, res) => {
  const username = req.query.user;

  if (!username) return res.send("NO USER");

  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.find(c => c.isTextBased());

  const invite = await channel.createInvite({
    maxAge: 0,
    maxUses: 1,
    unique: true
  });

  inviteMap.set(invite.code, username);

  res.send(`https://discord.gg/${invite.code}`);
});
