const axios = require('axios');
const dotenv = require('dotenv');
const express = require('express');
const {Client} = require('discord.js');
dotenv.config();
const client = new Client({intents: ['Guilds' , 'GuildMessages' , 'MessageContent','GuildVoiceStates']});
var VoiceChannelID;
const app = express();
const port = 3000 || process.env.PORT;
app.listen(port, () => {
    console.log(`Listening: http://localhost:${port}`);
});

client.commands = new Map();
const headers = {
    'Authorization': `Bot ${process.env.TOKEN}`,
    'Content-Type': 'application/json',
};
async function login() {
    try {
      await client.login(process.env.TOKEN);
      console.log(`Logged in as ${client.user.username}`);
      console.log(`Bot is in ${client.guilds.cache.size} servers`);
    } catch (error) {
      console.log('Failed to log in:', error);
      console.log('Client Not Login, Restarting Process...');
      process.kill(1);
    }
}
app.use(express.json());
app.post("/play",async(req,res,next)=>{
    try{
        const channelID = req.body.ChannelID
        VoiceChannelID= (req.body.VoiceChannelID);
        await axios.post(`https://discord.com/api/v10/channels/${channelID}/messages`,{"content":"!play "+req.body.content},{headers});
        res.json('Start Playing')
    }
    catch(err){
        console.log(err);
    }
})
const processCommand = async (message) => {
    try{
        if (!message.content.startsWith(process.env.PREFIX)) return;

        const args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        if (commandName === 'play') {
            const searchQuery = args.join(' ');
            if (!searchQuery) {
            return message.reply('** Please provide a search query!**');
            }
            console.log(VoiceChannelID)
            const connection = joinVoiceChannel({
                channelId: VoiceChannelID,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            currentConnection = connection; 
            currentMessage = message; 

            if (connection.state.status === VoiceConnectionStatus.Ready) {
                createPlayer();
                return message.reply('** Song added to Queue!**');
            }

            const listener = async (oldState, newState) => {
                if (newState.member.user.bot) {
                return;
                }
        
                if (oldState.channel && !newState.channel) {
                const membersInChannel = oldState.channel.members.size;
                if (membersInChannel === 1) {
                    message.client.removeListener('voiceStateUpdate', listener);
        
                    if (!connection.destroyed) {
                        connection.destroy();
                    }
                }
                }
            };

            message.client.on('voiceStateUpdate', listener);
            console.log('playing song')
            await playSong(connection, searchQuery, message);
        }
    }
    catch(err){
        console.log(err)
    }
};

client.on("messageCreate", processCommand);

client.once('ready', () => {
    setTimeout(() => {
      console.log(`Ready To Stream`);
    }, 2000); 
});

login();

client.once("reconnecting", () => {
    console.log("Reconnecting!");
});

client.once("disconnect", () => {
    console.log("Disconnect!");
});


const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    StreamType,
    AudioPlayerStatus,
    entersState,
    VoiceConnectionStatus,
} = require('@discordjs/voice');
const ytdl = require('ytdl-core');
let player;
function createPlayer() {
    try{if (!player) {
      player = createAudioPlayer();
    }}
    catch(err){
        console.log(err);
    }
}


async function playSong(connection, searchQuery, message){
    createPlayer();
    player.pause();
    let searchResult;
    try {
        console.log('https://www.googleapis.com/youtube/v3/search?q='+`${searchQuery}`+"&part=snippet&maxResults=1&key="+process.env.YT_API);
        searchResult = await fetch('https://www.googleapis.com/youtube/v3/search?q='+`${searchQuery}`+"&part=snippet&maxResults=1&key="+process.env.YT_API)
        .then((res)=>res.json());
    } catch (error) {
        console.error(error);
        return message.reply('There was an error searching for the song.');
    }
    if (!searchResult || !searchResult.items.length) {
        return message.reply('No search results found for the provided query.');
    }
    const video = searchResult.items[0];
    const youtubeLink = `https://www.youtube.com/watch?v=${video.id.videoId}`;
    const stream = ytdl(youtubeLink, { filter: 'audioonly' });
    const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
    });
    console.log('Now playing')
    player.play(resource);
    connection.subscribe(player);
    try{
        await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
        await entersState(player, AudioPlayerStatus.Playing, 20_000);
    }
    catch(error){
        console.error(error);
        if (!connection.destroyed) {
          connection.destroy();
        }
        message.reply('There was an error playing the music.');
    }
}
