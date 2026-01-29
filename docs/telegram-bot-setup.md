# Telegram Bot Setup Guide

This guide explains how to create a Telegram bot and configure it for use with memU.

## Step 1: Create a Bot with BotFather

1. Open Telegram and search for `@BotFather`
2. Start a chat and send `/newbot`
3. Follow the prompts:
   - Enter a **name** for your bot (e.g., "My AI Assistant")
   - Enter a **username** for your bot (must end with `bot`, e.g., `my_ai_assistant_bot`)
4. BotFather will provide your **Bot Token** - copy and save it securely

   ```
   Use this token to access the HTTP API:
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```

## Step 2: Configure Bot Settings (Optional but Recommended)

Send these commands to BotFather to customize your bot:

### Set Bot Description
```
/setdescription
```
Choose your bot, then enter a description that users will see when they start a chat.

### Set Bot About Text
```
/setabouttext
```
This appears in the bot's profile.

### Set Bot Profile Picture
```
/setuserpic
```
Upload an image to use as the bot's avatar.

### Enable Inline Mode (Optional)
```
/setinline
```
Allows users to use the bot inline in other chats.

## Step 3: Configure Privacy Settings

By default, bots can only see messages that:
- Are direct messages to the bot
- Start with a `/` command
- Mention the bot by @username

To allow the bot to see all messages in a group:
```
/setprivacy
```
Select your bot, then choose **Disable**.

> **Note:** This is only needed if you want the bot to respond to all messages in group chats.

## Step 4: Add Bot Token to memU

1. Open memU
2. Go to **Settings** → **Telegram**
3. Paste your **Bot Token**
4. Click **Connect**

## Step 5: Bind Your User Account

1. Open a chat with your bot in Telegram
2. Send the `/bind` command followed by your security code:
   ```
   /bind YOUR_SECURITY_CODE
   ```
3. The bot will confirm that your account is now bound

## Troubleshooting

### Bot not responding?
- Verify the token is correct
- Check if the bot is connected in memU (green status indicator)
- Ensure you've bound your account with `/bind`

### Can't receive messages in groups?
- Make sure privacy mode is disabled (see Step 3)
- Add the bot to the group as an admin

### Connection issues with proxy?
- Configure proxy settings in memU Settings → Proxy
- Telegram bots support SOCKS5 and HTTP proxies

## Bot Commands Reference

| Command | Description |
|---------|-------------|
| `/bind <code>` | Bind your Telegram account to memU |
| `/unbind` | Unbind your account |
| `/help` | Show available commands |

## Security Notes

- Never share your bot token publicly
- The bot token grants full control over the bot
- If compromised, revoke the token via BotFather using `/revoke`
- Only bind accounts you trust with the security code
