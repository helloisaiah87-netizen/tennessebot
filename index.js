// index.js
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";

// ===== CONFIG =====
const TOKEN = "MTQyMDkzMDc1MTU4NjYzMTgwMA.GPd3jX.0XSpxDyTXFtWS70R9aZZP6JTpvbuT6CJswgF_0";       // replace with your bot token
const GUILD_ID = "1368736318737088675";     // replace with your Discord server ID
const ROLE_ID = "1420928690170368160";       // replace with the role ID to assign
const PORT = process.env.PORT || 3000;
// ==================

const app = express();
app.use(express.json());

// ----- Discord client setup -----
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.on("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);

// ----- Test route -----
app.get("/", (req, res) => {
  res.send("✅ Server running! Send POST requests to /discord-webhook");
});

// ----- Webhook route -----
app.post("/discord-webhook", async (req, res) => {
  console.log("POST received:", req.body);

  const { discordId, score } = req.body;

  if (!discordId || !score) {
    console.log("❌ Missing discordId or score");
    return res.status(400).send("Missing discordId or score");
  }

  try {
    // Fetch guild
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log("✅ Fetched guild:", guild.name);

    // Fetch member
    const member = await guild.members.fetch(discordId);
    if (!member) return console.log("❌ Member not found:", discordId);
    console.log("✅ Fetched member:", member.user.tag);

    // Fetch role
    const role = guild.roles.cache.get(ROLE_ID);
    if (!role) return console.log("❌ Role not found:", ROLE_ID);

    // Assign role
    await member.roles.add(role);
    console.log(`🎉 Assigned role to ${member.user.tag} (Score: ${score})`);

  } catch (err) {
    console.error("❌ Error assigning role:", err);
  }

  res.send("ok");
});

// ----- Start Express server -----
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
