import express from "express";
import { Client, GatewayIntentBits } from "discord.js";

// -------- CONFIG --------
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || "1368736318737088675";
const ROLE_ID = process.env.DISCORD_ROLE_ID || "1420928690170368160";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const PORT = process.env.PORT || 5000;
// ------------------------

function isValidSnowflake(id) {
  return /^\d{17,19}$/.test(id);
}

const app = express();
app.use(express.json());

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

if (!TOKEN) {
  console.error("DISCORD_TOKEN environment variable is required!");
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.warn("WEBHOOK_SECRET not set - webhook will be unprotected!");
}

client.login(TOKEN);

app.get("/", (req, res) => {
  res.send("Server running! Send POST requests to /discord-webhook");
});

app.post("/discord-webhook", async (req, res) => {
  const providedSecret = req.headers['x-webhook-secret'];
  if (!WEBHOOK_SECRET || providedSecret !== WEBHOOK_SECRET) {
    console.log("Unauthorized webhook attempt");
    return res.status(401).send("Unauthorized");
  }

  console.log("POST received:", req.body);

  const { discordId, score } = req.body;

  if (!discordId || !score) {
    console.log("Missing discordId or score");
    return res.status(400).send("Missing discordId or score");
  }

  if (!isValidSnowflake(discordId)) {
    console.log("Invalid Discord ID format:", discordId);
    return res.status(400).send("Invalid Discord ID format");
  }

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const role = guild.roles.cache.get(ROLE_ID);

    if (!member) {
      console.log("Member not found:", discordId);
      return res.status(404).send("Member not found");
    }
    if (!role) {
      console.log("Role not found:", ROLE_ID);
      return res.status(500).send("Role configuration error");
    }

    await member.roles.add(role);
    console.log(`Assigned role to ${member.user.tag} (Score: ${score})`);
    res.send("Role assigned successfully");
  } catch (err) {
    console.error("Error assigning role:", err);
    res.status(500).send("Internal server error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
