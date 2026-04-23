require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, ActivityType } = require('discord.js');
const Groq = require('groq-sdk');
const express = require('express');
const path = require('path');

// Servidor Web para Uptime
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log(`\x1b[36m[WEB]\x1b[0m Servidor web listo en el puerto ${port}`);
});

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.once('ready', () => {
    console.log(`\x1b[32m[LOG]\x1b[0m Bot online con GROQ: ${client.user.tag}`);
    
    const activities = [
        { 
            name: 'Game Community', 
            type: ActivityType.Playing,
            details: 'La mejor comunidad de juegos',
            state: 'Desarrollado por GonzalO',
            buttons: [
                { label: 'Ver Creador', url: 'https://discord.com/users/1247158284947951697' }
            ]
        },
        { 
            name: 'Created by GonzalO', 
            type: ActivityType.Custom 
        }
    ];

    let i = 0;
    setInterval(() => {
        client.user.setActivity(activities[i]);
        i = (i + 1) % activities.length;
    }, 5000); // Cambia cada 5 segundos
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM || message.mentions.has(client.user)) {
        if (!groq) return message.reply('❌ Falta GROQ_API_KEY en el .env');

        try {
            await message.channel.sendTyping();
            const prompt = message.content.replace(/<@!?[0-9]+>/g, '').trim() || "Hola";

            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: 'system', content: 'Eres un asistente amigable.' },
                    { role: 'user', content: prompt }
                ],
                model: 'llama-3.1-8b-instant',
            });

            message.reply(chatCompletion.choices[0].message.content);
        } catch (error) {
            console.error('Error:', error.message);
            message.reply(`😵 Error: ${error.message}`);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
