import express from "express";
import bodyParser from "body-parser";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(bodyParser.json());

// 🔑 Fill these in
const TOKEN = "YOUR_DISCORD_BOT_TOKEN";
const ROLE_ID = "ROLE_ID_TO_ASSIGN";
const GUILD_ID = "YOUR_SERVER_ID";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Webhook endpoint (Google Sheets will call this)
app.post("/discord-webhook", async (req, res) => {
  const { discordId, score } = req.body;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);

    await member.roles.add(ROLE_ID);
    console.log(`🎉 Assigned role to ${member.user.tag} (Score: ${score})`);
    res.status(200).send("Role assigned");
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).send("Error assigning role");
  }
});

client.login(TOKEN);

// Replit listens on a random port, so use process.env.PORT
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Webhook server running")
);
