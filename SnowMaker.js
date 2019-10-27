const Discord = require('discord.js');
const ffmpeg = require('ffmpeg-binaries');
const opus = require('node-opus');
const ytdl = require('ytdl-core');
const { prefix, token } = require('./config.json');

const bot = new Discord.Client();
bot.login(token)
const queue = new Map();

bot.once('ready', () => {
  console.log('Ready!');
  bot.user.setActivity("You", { type: "WATCHING" })
});

bot.once('reconnecting', () => {
	console.log('Reconnecting!');
});

bot.once('disconnect', () => {
	console.log('Disconnect!');
});

bot.on('message', async receivedMessage => {
  if (receivedMessage.author == bot.user) { // Prevent bot from responding to its own messages
    return
  }


  // You can copy/paste the actual unicode emoji in the code (not _every_ unicode emoji works)
  // Unicode emojis: https://unicode.org/emoji/charts/full-emoji-list.html

  // If you know the ID of the custom emoji you want, you can get it directly with:
  // let customEmoji = receivedMessage.guild.emojis.get(emojiId)
  if (receivedMessage.content.startsWith(prefix)) {
    //receivedMessage.react("🖕")
    processCommand(receivedMessage)
  }
})


function processCommand(receivedMessage) {
  let fullCommand = receivedMessage.content.substr(1) // Remove the prefix
  let splitCommand = fullCommand.split(" ") // Split the message up in to pieces for each space
  let primaryCommand = splitCommand[0] // The first word directly after the prefix is the command
  let arguments = splitCommand.slice(1) // All other words are arguments/parameters/options for the command

  if (primaryCommand === "help") {
    help(receivedMessage)
  }
  else if (primaryCommand === "multiply") {
    multiply(arguments, receivedMessage)
  }
  else if (primaryCommand === "play" || primaryCommand === "p") {
    executePlay(arguments, receivedMessage)
  }
  else if (primaryCommand === "pause") {
    pause(receivedMessage)
  }
  else if (primaryCommand === "resume") {
    resume(receivedMessage)
  }
  else if (primaryCommand === "skip" || primaryCommand === "s") {
    skip(receivedMessage)
  }
  else if (primaryCommand === "stop") {
    stop(receivedMessage)
  }
  else {
    receivedMessage.channel.send("I don't understand you, try `" + prefix + "help`")
  }
}

function help(receivedMessage) {
  let helpText = ""
  helpText += "List of commands and their parameters:\n"
  helpText += "- Multiply: `" + prefix + "multiply num1 num2 num3 etc`\n"
  helpText += "- Play: `" + prefix + "play youtubelink/description` or `" + prefix + "p youtubelink/description`\n"
  helpText += "- Pause: `" + prefix + "pause`\n"
  helpText += "- Resume: `" + prefix + "resume`\n"
  helpText += "- Skip: `" + prefix + "skip` or `" + prefix + "s`\n"
  helpText += "- Stop: `" + prefix + "stop`\n"
  receivedMessage.channel.send(helpText)
}

function multiply(arguments, receivedMessage) {
  if (arguments.length < 2) {
    receivedMessage.channel.send("Not enough values to multiply. Try `" + prefix + "multiply 2 4 10` or `" + prefix + "multiply 5.2 7`")
    return
  }
  let product = 1
  let niceString = ''
  arguments.forEach((value) => {
    product = product * parseFloat(value)
    niceString += value + ', '
  })
  receivedMessage.channel.send("The product of " + niceString + "multiplied together is: " + parseFloat(product.toPrecision(2)).toString())
}

async function executePlay(arguments, receivedMessage) {

  const serverQueue = queue.get(receivedMessage.guild.id);
	const voiceChannel = receivedMessage.member.voiceChannel;
	if (!voiceChannel) return receivedMessage.channel.send('You need to be in a voice channel to play music!');
	const permissions = voiceChannel.permissionsFor(receivedMessage.client.user);
	if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
		return receivedMessage.channel.send('I need the permissions to join and speak in your voice channel!');
	}

	const songInfo = await ytdl.getInfo(arguments.join(" "));
	const song = {
		title: songInfo.title,
		url: songInfo.video_url,
	};

	if (!serverQueue) {
		const queueContract = {
			textChannel: receivedMessage.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true,
		};

		queue.set(receivedMessage.guild.id, queueContract);

		queueContract.songs.push(song);

		try {
			var connection = await voiceChannel.join();
      queueContract.connection = connection;
      console.log(queueContract.songs[queueContract.songs.length - 1])
			play(receivedMessage.guild, queueContract.songs[0]);
		} catch (err) {
			console.log(err);
			queue.delete(receivedMessage.guild.id);
			return receivedMessage.channel.send(err);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs[serverQueue.songs.length - 1]);
		return receivedMessage.channel.send(`${song.title} has been added to the queue!`);
  }
}

function play(guild, song) {
  const serverQueue = queue.get(guild.id);

  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }
  const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
    .on('end', () => {
      console.log('Music ended!');
      serverQueue.songs.shift();
      play(guild, serverQueue.songs[0]);
    })
    .on('error', error => {
      console.error(error);
    });
  dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
}

function pause(receivedMessage) {
  const serverQueue = queue.get(receivedMessage.guild.id);
  if (!receivedMessage.member.voiceChannel) return receivedMessage.channel.send('You have to be in a voice channel to pause the music!');
  if (!serverQueue) return receivedMessage.channel.send('There is no song to pause!');
  serverQueue.connection.dispatcher.pause();
}

function resume(receivedMessage) {
  const serverQueue = queue.get(receivedMessage.guild.id);
  if (!receivedMessage.member.voiceChannel) return receivedMessage.channel.send('You have to be in a voice channel to resume music!');
  if (!serverQueue) return receivedMessage.channel.send('There is no song to resume!');
  serverQueue.connection.dispatcher.resume();
}

function skip(receivedMessage) {
  const serverQueue = queue.get(receivedMessage.guild.id);
  if (!receivedMessage.member.voiceChannel) return receivedMessage.channel.send('You have to be in a voice channel to skip the music!');
  if (!serverQueue) return receivedMessage.channel.send('There is no song that I could skip!');
  serverQueue.connection.dispatcher.end();
}

function stop(receivedMessage) {
  const serverQueue = queue.get(receivedMessage.guild.id);
  if (!receivedMessage.member.voiceChannel) return receivedMessage.channel.send('You have to be in a voice channel to stop the music!');
  serverQueue.songs = [];
  serverQueue.connection.dispatcher.end();
}