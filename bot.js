require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, ActivityType, Collection, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const Groq = require('groq-sdk');
const express = require('express');
const path = require('path');
const fs = require('fs');

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
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// Comandos
client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'Commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

client.once('ready', async () => {
    console.log(`\x1b[32m[LOG]\x1b[0m Bot online con GROQ: ${client.user.tag}`);
    
    // Registro de comandos slash
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log(`\x1b[33m[SYS]\x1b[0m Iniciando el registro de ${commands.length} comandos slash...`);
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, process.env.SERVER_ID),
            { body: commands },
        );
        console.log('\x1b[32m[SYS]\x1b[0m Comandos registrados correctamente en el servidor.');
    } catch (error) {
        console.error('\x1b[31m[ERR]\x1b[0m Error al registrar comandos:', error);
    }

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
        client.user.setPresence({
            activities: [activities[i]],
            status: 'online',
        });
        i = (i + 1) % activities.length;
    }, 5000);
});

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        console.log(`\x1b[35m[INTERACTION]\x1b[0m Recibido comando: ${interaction.commandName}`);
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.log(`\x1b[31m[ERR]\x1b[0m No se encontró el comando: ${interaction.commandName}`);
            return;
        }

        try {
            await command.execute(interaction);
            console.log(`\x1b[32m[OK]\x1b[0m Comando ${interaction.commandName} ejecutado.`);
        } catch (error) {
            console.error(`\x1b[31m[ERR]\x1b[0m Error en comando ${interaction.commandName}:`, error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: `❌ Hubo un error: \`${error.message}\``, ephemeral: true });
            } else {
                await interaction.reply({ content: `❌ Hubo un error: \`${error.message}\``, ephemeral: true });
            }
        }
    } else if (interaction.isButton()) {
        // Manejo de Tickets
        const ADMIN_ID = '1496571953413099700';

        if (interaction.customId === 'open_ticket') {
            await interaction.deferReply({ ephemeral: true });

            const channelName = `ticket-${interaction.user.username}`.toLowerCase();
            const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);

            if (existingChannel) {
                return interaction.editReply({ content: `❌ Ya tienes un ticket abierto: ${existingChannel}` });
            }

            try {
                const ticketChannel = await interaction.guild.channels.create({
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                            deny: [PermissionFlagsBits.SendMessages], // No puede hablar hasta que se reclame
                        },
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setTitle('🎫 Ticket de Soporte')
                    .setDescription(`Hola ${interaction.user}, bienvenido a tu ticket.\n\n⚠️ **Esperando a que un staff reclame el ticket.**\nNadie puede hablar hasta que un moderador use el botón de **Reclamar**.`)
                    .setColor('#00ff00')
                    .setImage('https://i.imgur.com/wfkYmPD.jpeg')
                    .setTimestamp();

                const buttons = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('claim_ticket')
                            .setLabel('Reclamar Staff')
                            .setEmoji('🙋‍♂️')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Cerrar Ticket')
                            .setEmoji('🔒')
                            .setStyle(ButtonStyle.Danger)
                    );

                await ticketChannel.send({ embeds: [ticketEmbed], components: [buttons] });
                await interaction.editReply({ content: `✅ Ticket creado correctamente: ${ticketChannel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ Error al crear el ticket.' });
            }
        } else if (interaction.customId === 'claim_ticket') {
            // Verificar si el usuario es staff (puedes ajustar esto según roles, pero el usuario no especificó)
            // Asumiremos que cualquiera que pueda ver el canal de configuración o tenga permisos puede reclamar, 
            // o simplemente permitiremos que cualquier miembro con permisos de moderación lo haga.
            // Para ser seguros, permitiremos que el staff reclame.
            
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                SendMessages: true,
                ViewChannel: true
            });

            // Permitir hablar al usuario que abrió el ticket
            // Buscamos el permiso que no es everyone y no es el staff actual
            const ticketOpenerPermission = interaction.channel.permissionOverwrites.cache.find(po => po.type === 1 && po.id !== interaction.user.id && po.id !== interaction.guild.id);
            
            if (ticketOpenerPermission) {
                await interaction.channel.permissionOverwrites.edit(ticketOpenerPermission.id, {
                    SendMessages: true
                });
            }

            const claimEmbed = new EmbedBuilder()
                .setTitle('✅ Ticket Reclamado')
                .setDescription(`El staff ${interaction.user} ha reclamado este ticket. Ya podéis hablar.`)
                .setColor('#3498db')
                .setTimestamp();

            await interaction.reply({ embeds: [claimEmbed] });
            
            // Editar el mensaje original para quitar el botón de reclamar si quieres, o dejarlo.
            // El usuario pidió que si no reclaman no se habla.
        } else if (interaction.customId === 'close_ticket') {
            if (interaction.user.id !== ADMIN_ID) {
                return interaction.reply({ content: '❌ Solo el administrador autorizado puede cerrar tickets.', ephemeral: true });
            }

            // Mostrar Modal de Valoración
            const modal = new ModalBuilder()
                .setCustomId('rate_ticket_modal')
                .setTitle('Valoración del Ticket');

            const ratingInput = new TextInputBuilder()
                .setCustomId('rating_value')
                .setLabel('Puntúa el ticket (0-10)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ej: 10')
                .setMinLength(1)
                .setMaxLength(2)
                .setRequired(true);

            const commentInput = new TextInputBuilder()
                .setCustomId('rating_comment')
                .setLabel('Comentario (opcional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(ratingInput), new ActionRowBuilder().addComponents(commentInput));

            await interaction.showModal(modal);
        }
    } else if (interaction.isModalSubmit()) {
        if (interaction.customId === 'rate_ticket_modal') {
            const ADMIN_ID = '1496571953413099700';
            const VALUATION_CHANNEL_ID = '1497238224928505937';
            const LOG_CHANNEL_ID = '1497239520716783677';

            const rating = interaction.fields.getTextInputValue('rating_value');
            const comment = interaction.fields.getTextInputValue('rating_comment') || 'Sin comentario';

            // Validar que sea un número entre 0 y 10
            const score = parseInt(rating);
            if (isNaN(score) || score < 0 || score > 10) {
                return interaction.reply({ content: '❌ Por favor, introduce un número válido entre 0 y 10.', ephemeral: true });
            }

            await interaction.reply({ content: '⌛ Procesando cierre del ticket...' });

            // Enviar valoración
            const valChannel = interaction.guild.channels.cache.get(VALUATION_CHANNEL_ID);
            if (valChannel) {
                const valEmbed = new EmbedBuilder()
                    .setTitle('⭐ Nueva Valoración de Ticket')
                    .addFields(
                        { name: 'Ticket', value: interaction.channel.name, inline: true },
                        { name: 'Admin', value: interaction.user.tag, inline: true },
                        { name: 'Puntuación', value: `${score}/10`, inline: true },
                        { name: 'Comentario', value: comment }
                    )
                    .setColor('#f1c40f')
                    .setTimestamp();
                await valChannel.send({ embeds: [valEmbed] });
            }

            // Enviar Log
            const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('📝 Log de Ticket Cerrado')
                    .setDescription(`El ticket **${interaction.channel.name}** ha sido cerrado por ${interaction.user}.`)
                    .setColor('#e74c3c')
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            // Embed de despedida
            const closeEmbed = new EmbedBuilder()
                .setTitle('🚪 Cerrando Ticket')
                .setDescription(`Esto, si el admin tiene buena reputacion podra ascender como staff.\n\n¡Gracias por abrir un ticket! El ticket se cierra en 1 Minuto.`)
                .setColor('#e74c3c')
                .setFooter({ text: 'Game Community' })
                .setTimestamp();

            await interaction.channel.send({ embeds: [closeEmbed] });

            // Esperar 1 minuto y borrar
            setTimeout(() => {
                interaction.channel.delete().catch(console.error);
            }, 60000);
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- Lógica AFK ---
    const afkPath = path.join(__dirname, 'afk.json');
    if (fs.existsSync(afkPath)) {
        let afkData = JSON.parse(fs.readFileSync(afkPath, 'utf8'));

        // 1. Quitar AFK si el autor escribe
        if (afkData[message.author.id]) {
            const data = afkData[message.author.id];
            delete afkData[message.author.id];
            fs.writeFileSync(afkPath, JSON.stringify(afkData, null, 4));

            // Restaurar apodo (Solo si no es admin protegido y el bot puede gestionarlo)
            const adminsPath = path.join(__dirname, 'admins.json');
            let admins = [];
            if (fs.existsSync(adminsPath)) admins = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));

            try {
                const member = message.guild.members.cache.get(message.author.id);
                if (member && !admins.includes(message.author.id) && member.manageable) {
                    await member.setNickname(data.oldNickname === message.author.username ? null : data.oldNickname);
                }
            } catch (error) {
                console.error('No se pudo restaurar el apodo:', error);
            }

            message.reply(`👋 ¡Bienvenido de nuevo! He quitado tu estado AFK.`).then(m => {
                setTimeout(() => {
                    m.delete().catch(() => {});
                }, 5000);
            }).catch(() => {});
        }

        // 2. Avisar si alguien menciona a un usuario AFK
        message.mentions.users.forEach(user => {
            if (afkData[user.id]) {
                const data = afkData[user.id];
                const time = Math.floor(data.timestamp / 1000);
                message.reply({
                    content: `💤 **${user.username}** está AFK: ${data.reason} (<t:${time}:R>)`,
                    allowedMentions: { repliedUser: false }
                });
            }
        });
    }
    // --- Fin Lógica AFK ---

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
