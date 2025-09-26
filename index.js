// index.js
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";

// -------- CONFIG --------
const TOKEN = "MTQyMDkzMDc1MTU4NjYzMTgwMA.GPd3jX.0XSpxDyTXFtWS70R9aZZP6JTpvbuT6CJswgF_0";
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1368736318737088675";
const ROLE_ID = process.env.DISCORD_ROLE_ID || "1420928690170368160";
const PORT = process.env.PORT || 5000;
// ------------------------

const app = express();
app.use(express.json());

// Discord client setup
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Check if token is provided
if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN environment variable is required!");
  process.exit(1);
}

client.login(TOKEN);

// Test route to confirm server is running
app.get("/", (req, res) => {
  res.send("✅ Server running! Send POST requests to /discord-webhook");
});

// Webhook route to assign roles
app.post("/discord-webhook", async (req, res) => {
  console.log("POST received:", req.body);

  const { discordId, score } = req.body;

  if (!discordId || !score) {
    console.log("❌ Missing discordId or score");
    return res.status(400).send("Missing discordId or score");
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const role = guild.roles.cache.get(ROLE_ID);

    if (!member) return console.log("❌ Member not found:", discordId);
    if (!role) return console.log("❌ Role not found:", ROLE_ID);

    await member.roles.add(role);
    console.log(`🎉 Assigned role to ${member.user.tag} (Score: ${score})`);
  } catch (err) {
    console.error("❌ Error assigning role:", err);
  }

  res.send("ok");
});

// Start Express server on Replit
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});
