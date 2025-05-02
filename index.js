const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const express = require("express");
const axios = require("axios"); // For making API requests
const cheerio = require("cheerio"); // For web scraping if needed
const app = express();

app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(3000, () => console.log("🌐 Express server is running"));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.GuildMember, Partials.Message, Partials.Reaction],
});

const TOKEN = "MTM2Nzk4NzI4NDU0NDE5MjY3Mw.GOpC30.5KXJ3Cadz8r9WjUwQb5WJZkpnJ9v8xJCLTosbw";
const CLIENT_ID = "1367987284544192673";
const GUILD_ID = "1366171798210609193";

// Store reaction roles
const reactionRoles = new Map();

// Configuration for e-sports news
const ESPORTS_CONFIG = {
  channelName: "📢・free-fire-news", // Channel where news will be posted
  checkInterval: 3600000, // Check every hour (3600000 ms)
  sources: [
    {
      name: "Free Fire Esports",
      url: "https://ff.garena.com/news/esports/",
      selector: ".news-item", // Example selector, adjust based on actual site structure
    },
    // Add more sources as needed
  ],
  lastChecked: new Date(),
  lastNewsIds: new Set(), // To avoid duplicate posts
};

const commands = [
  // ... (keep all your existing commands)
  new SlashCommandBuilder()
    .setName("setup-news")
    .setDescription("Setup the e-sports news channel")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Channel for news updates")
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName("force-news")
    .setDescription("Force fetch latest e-sports news"),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("❌ Error registering commands", err);
  }
  client.user.setActivity("By ZhxDEV </>", { type: ActivityType.Playing });
  
  // Start the news checking interval
  setInterval(checkEsportsNews, ESPORTS_CONFIG.checkInterval);
});

// Function to fetch and post e-sports news
async function checkEsportsNews() {
  try {
    console.log("🔍 Checking for Free Fire e-sports news...");
    
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return;
    
    // Find the news channel
    const newsChannel = guild.channels.cache.find(
      c => c.name === ESPORTS_CONFIG.channelName && c.isTextBased()
    );
    
    if (!newsChannel) {
      console.log(`❌ News channel '${ESPORTS_CONFIG.channelName}' not found`);
      return;
    }
    
    // Check each news source
    for (const source of ESPORTS_CONFIG.sources) {
      try {
        const response = await axios.get(source.url);
        const $ = cheerio.load(response.data);
        
        // Extract news items (adjust selector based on actual site structure)
        $(source.selector).each(async (index, element) => {
          const title = $(element).find("h3").text().trim();
          const url = $(element).find("a").attr("href");
          const image = $(element).find("img").attr("src");
          const date = $(element).find(".date").text().trim();
          
          // Skip if we don't have basic info or if we've already posted this
          if (!title || !url || ESPORTS_CONFIG.lastNewsIds.has(url)) return;
          
          // Create and send embed
          const embed = new EmbedBuilder()
            .setTitle(title)
            .setURL(url.startsWith("http") ? url : new URL(url, source.url).href)
            .setColor("#FF5733") // Free Fire orange color
            .setFooter({ text: `${source.name} • ${date || new Date().toLocaleDateString()}` });
            
          if (image) {
            embed.setThumbnail(image.startsWith("http") ? image : new URL(image, source.url).href);
          }
          
          await newsChannel.send({ 
            content: "🎮 **New Free Fire Tournament Update!**",
            embeds: [embed] 
          });
          
          // Remember we've posted this
          ESPORTS_CONFIG.lastNewsIds.add(url);
          console.log(`Posted news: ${title}`);
        });
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error.message);
      }
    }
    
    ESPORTS_CONFIG.lastChecked = new Date();
  } catch (error) {
    console.error("Error in checkEsportsNews:", error);
  }
}

// Add these to your existing interactionCreate handler
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  // ... (keep all your existing command handlers)

  if (commandName === "setup-news") {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageChannels)) {
      return interaction.reply({ 
        content: "❌ You need Manage Channels permission to use this command.", 
        ephemeral: true 
      });
    }
    
    const channel = interaction.options.getChannel("channel");
    ESPORTS_CONFIG.channelName = channel.name;
    
    await interaction.reply({ 
      content: `✅ Free Fire e-sports news will now be posted in ${channel.toString()}`,
      ephemeral: true 
    });
  }

  if (commandName === "force-news") {
    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ 
        content: "❌ You need Manage Messages permission to use this command.", 
        ephemeral: true 
      });
    }
    
    await interaction.deferReply({ ephemeral: true });
    await checkEsportsNews();
    await interaction.editReply("✅ Forced news check completed!");
  }
});

// ... (keep all your existing event handlers)

client.login(TOKEN);