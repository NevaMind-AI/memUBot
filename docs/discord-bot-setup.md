# Discord Bot Setup Guide

This guide explains how to create a Discord bot and configure it for use with memU.

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Enter a name for your application (e.g., "memU Assistant")
4. Accept the Terms of Service and click **Create**

## Step 2: Configure the Bot

1. In your application, go to the **Bot** section in the left sidebar
2. Click **Add Bot** and confirm
3. Configure bot settings:
   - **Username**: Set a display name for your bot
   - **Icon**: Upload a profile picture
   - **Public Bot**: Disable if you only want yourself to add the bot
   - **Requires OAuth2 Code Grant**: Leave disabled

### Get Your Bot Token

1. In the **Bot** section, find the **Token** area
2. Click **Reset Token** (you may need to enter 2FA)
3. Copy the token and save it securely

   ```
   MTIzNDU2Nzg5MDEyMzQ1Njc4.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

> **Warning:** This token is shown only once. If lost, you must reset it.

## Step 3: Configure Privileged Gateway Intents

In the **Bot** section, scroll down to **Privileged Gateway Intents** and enable:

- ✅ **Presence Intent** - Track user online status
- ✅ **Server Members Intent** - Access member list
- ✅ **Message Content Intent** - Read message content (Required!)

> **Important:** Without Message Content Intent, the bot cannot read user messages.

## Step 4: Generate Invite URL

1. Go to **OAuth2** → **URL Generator** in the left sidebar
2. Select **Scopes**:
   - ✅ `bot`
   - ✅ `applications.commands` (for slash commands)

3. Select **Bot Permissions**:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Use External Emojis

   Or use **Administrator** for full permissions (not recommended for security).

4. Copy the generated URL at the bottom

## Step 5: Add Bot to Your Server

1. Open the generated invite URL in a browser
2. Select the server where you want to add the bot
3. Authorize the permissions
4. Complete the CAPTCHA if prompted

## Step 6: Configure in memU

1. Open memU
2. Go to **Settings** → **Discord**
3. Paste your **Bot Token**
4. Click **Connect**

## Step 7: Bind Your User Account

1. In any channel where the bot can see messages, type:
   ```
   /bind YOUR_SECURITY_CODE
   ```
2. The bot will confirm that your Discord account is now bound

## Bot Permissions Explained

| Permission | Purpose |
|------------|---------|
| Read Messages | See messages in channels |
| Send Messages | Reply to users |
| Embed Links | Send rich embed messages |
| Attach Files | Share files and images |
| Read Message History | Access previous messages |
| Add Reactions | React to messages |

## Troubleshooting

### Bot is offline?
- Verify the token is correct in memU settings
- Check if the bot is connected (green indicator)
- Ensure the bot has permissions in the channel

### Bot can't read messages?
- Enable **Message Content Intent** in Developer Portal
- Make sure the bot has "Read Messages" permission in the channel

### Can't use slash commands?
- Ensure `applications.commands` scope was included in the invite URL
- Re-invite the bot with correct scopes
- Wait a few minutes for Discord to sync commands

### Bot not responding to DMs?
- The user must share a server with the bot
- Or the user must have DMs enabled for server members

## Security Notes

- Never share your bot token publicly
- Regenerate the token immediately if compromised
- Use minimal permissions necessary for your use case
- Only bind accounts you trust with the security code

## Advanced: Running Multiple Bots

Each Discord bot requires:
- A separate Discord Application
- Its own unique bot token
- Proper intents and permissions

You can run multiple bot instances with different tokens for different servers or purposes.
