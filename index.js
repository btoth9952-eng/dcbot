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

// -------------------------
// FILE HANDLING
// -------------------------
function loadInvites() {
    if (!fs.existsSync("invites.json")) return {};
    return JSON.parse(fs.readFileSync("invites.json"));
}

function saveInvites(data) {
    fs.writeFileSync("invites.json", JSON.stringify(data, null, 2));
}

function loadUsers() {
    if (!fs.existsSync("users.json")) return {};
    return JSON.parse(fs.readFileSync("users.json"));
}

function saveUsers(data) {
    fs.writeFileSync("users.json", JSON.stringify(data, null, 2));
}

// -------------------------
// INVITE CACHE (FIX CORE)
// -------------------------
let cachedInvites = new Map();

async function cacheInvites(guild) {
    const invites = await guild.invites.fetch();
    invites.forEach(inv => {
        cachedInvites.set(inv.code, inv.uses);
    });
}

// -------------------------
// READY
// -------------------------
client.once("ready", async () => {
    console.log(`Bot online: ${client.user.tag}`);

    await client.guilds.fetch();

    const guild = client.guilds.cache.first();
    if (guild) {
        await cacheInvites(guild);
    }
});

// -------------------------
// INVITE GENERÁLÁS
// -------------------------
app.get("/create-invite", async (req, res) => {
    try {
        const username = req.query.user;

        if (!username) return res.status(400).send("NO USER");

        const guilds = await client.guilds.fetch();
        const guild = guilds.first();

        if (!guild) return res.status(500).send("NO GUILD");

        const fullGuild = await guild.fetch();
        await fullGuild.channels.fetch();

        let channel = fullGuild.systemChannel;

        if (!channel) {
            channel = fullGuild.channels.cache
                .filter(c =>
                    c.isTextBased() &&
                    c.permissionsFor(client.user)?.has(PermissionFlagsBits.CreateInstantInvite)
                )
                .first();
        }

        if (!channel) return res.status(500).send("NO CHANNEL");

        const invite = await channel.createInvite({
            maxAge: 0,
            maxUses: 0,
            unique: true,
            reason: `Referral for ${username}`
        });

        let invites = loadInvites();
        invites[invite.code] = username;
        saveInvites(invites);

        return res.status(200).send(invite.url);

    } catch (err) {
        console.error("CREATE INVITE ERROR:", err);
        return res.status(500).send("ERROR: " + err.message);
    }
});

// -------------------------
// JOIN TRACKING (FIXED)
// -------------------------
client.on("guildMemberAdd", async (member) => {
    try {
        const oldInvites = new Map(cachedInvites);

        const newInvites = await member.guild.invites.fetch();

        const usedInvite = newInvites.find(inv => {
            const oldUses = oldInvites.get(inv.code) || 0;
            return inv.uses > oldUses;
        });

        if (!usedInvite) {
            console.log("Nem található használt invite");
            await cacheInvites(member.guild);
            return;
        }

        const inviteMap = loadInvites();
        const inviter = inviteMap[usedInvite.code];

        if (!inviter) {
            console.log("Invite code nincs hozzárendelve userhez");
            await cacheInvites(member.guild);
            return;
        }

        console.log(`${member.user.username} joined via ${inviter}`);

        await fetch(
            `https://kasziradar.hu/api/add_points.php?user=${inviter}&points=5&secret=MY_SECRET`
        );

        // users.json safe update
        let users = loadUsers();

        if (!users[inviter]) {
            users[inviter] = { invited: [] };
        }

        users[inviter].invited.push({
            discord_id: member.user.id,
            discord_name: member.user.username
        });

        saveUsers(users);

        // refresh cache
        await cacheInvites(member.guild);

    } catch (err) {
        console.error("JOIN ERROR:", err);
    }
});
console.log("INVITES:");
newInvites.forEach(i => {
    console.log(i.code, i.uses);
});

console.log("CACHED:");
console.log([...oldInvites.entries()]);
// -------------------------
// EXPRESS SERVER
// -------------------------
app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
});

// -------------------------
client.login(TOKEN);
