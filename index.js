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