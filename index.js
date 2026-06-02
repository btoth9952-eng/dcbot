import { Client, GatewayIntentBits, PermissionFlagsBits } from "discord.js";
import express from "express";
import fetch from "node-fetch";
import fs from "fs";
const TOKEN = process.env.TOKEN;
const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
app.use(express.json());

function loadInvites() {
    if (!fs.existsSync("invites.json")) return {};
    return JSON.parse(fs.readFileSync("invites.json"));
}

function saveInvites(data) {
    fs.writeFileSync("invites.json", JSON.stringify(data, null, 2));
}

// -------------------------
// READY
// -------------------------
client.once("ready", async () => {
  console.log(`Bot online: ${client.user.tag}`);

  // fontos: guild cache fix
  await client.guilds.fetch();
});

// -------------------------
// INVITE GENERÁLÁS
// -------------------------
app.get("/create-invite", async (req, res) => {
  try {
    const username = req.query.user;

    if (!username) {
      return res.status(400).send("NO USER");
    }

    // guild fetch fix (NE cache-re építs)
    const guilds = await client.guilds.fetch();
    const guild = guilds.first();

    if (!guild) {
      return res.status(500).send("NO GUILD");
    }

    const fullGuild = await guild.fetch();
    await fullGuild.channels.fetch();

    // legbiztonságosabb: system channel
    let channel = fullGuild.systemChannel;

    // fallback ha nincs system channel
    if (!channel) {
      channel = fullGuild.channels.cache
        .filter(c =>
          c.isTextBased() &&
          c.permissionsFor(client.user).has(PermissionFlagsBits.CreateInstantInvite)
        )
        .first();
    }

    if (!channel) {
      return res.status(500).send("NO CHANNEL");
    }

    // invite create
const invite = await channel.createInvite({
    maxAge: 0,
    maxUses: 0,
    unique: true,
    reason: `Referral for ${username}`
});

let invites = loadInvites();
invites[invite.code] = username;
saveInvites(invites);
    if (!invite?.url) {
      return res.status(500).send("INVITE FAILED");
    }


    return res.status(200).send(invite.url);

  } catch (err) {
    console.error("CREATE INVITE ERROR:", err);
    return res.status(500).send("ERROR: " + err.message);
  }
});

// -------------------------
// INVITE TRACKING
// -------------------------
client.on("guildMemberAdd", async (member) => {
    try {

        const invites = loadInvites();

        const newInvites = await member.guild.invites.fetch();

        const used = newInvites.find(inv =>
            invites[inv.code]
        );

        if (!used) return;

        const inviter = invites[used.code];

        console.log(`${member.user.username} joined via ${inviter}`);

        await fetch(
            `https://kasziradar.hu/api/add_points.php?user=${inviter}&points=5&secret=MY_SECRET`
        );

        // mentjük ki lett meghívva
        const users = JSON.parse(fs.readFileSync("users.json"));

        if (!users[inviter].invited) {
            users[inviter].invited = [];
        }

        users[inviter].invited.push({
            discord_id: member.user.id,
            discord_name: member.user.username
        });

        fs.writeFileSync("users.json", JSON.stringify(users, null, 2));

    } catch (err) {
        console.error(err);
    }
});

// -------------------------
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

client.login(TOKEN);
