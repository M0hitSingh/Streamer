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
var {VoiceChannelID }= require('./index')

const queue = [];
let player;
let currentConnection; 
let currentMessage; 
function createPlayer() {
    if (!player) {
      player = createAudioPlayer();
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

module.exports = {
    name:'play',
    description: 'Play music from YouTube',
    execute: async (message, args) => {
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

        // if (connection.state.status === VoiceConnectionStatus.Ready) {
        //     createPlayer();
        //     return message.reply('** Song added to Queue!**');
        // }

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
    },
    queue,
    playSong,
}