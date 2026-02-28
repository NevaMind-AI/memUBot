# Slack Bot Setup Guide

This guide explains how to create a Slack bot and configure it for use with memU.

## Step 1: Create a Slack App

1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Enter:
   - **App Name**: e.g., "memU Assistant"
   - **Workspace**: Select your workspace
5. Click **Create App**

## Step 2: Configure OAuth & Permissions

1. In the left sidebar, go to **OAuth & Permissions**
2. Scroll to **Scopes** section
3. Add the following **Bot Token Scopes**:

### Required Scopes

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive messages that mention the bot |
| `channels:history` | Read messages in public channels |
| `channels:read` | View basic channel info |
| `chat:write` | Send messages |
| `commands` | Add slash commands |
| `files:read` | Access files shared with the bot |
| `files:write` | Upload files |
| `groups:history` | Read messages in private channels |
| `groups:read` | View private channel info |
| `im:history` | Read direct messages |
| `im:read` | View DM info |
| `im:write` | Start direct messages |
| `mpim:history` | Read group DM messages |
| `mpim:read` | View group DM info |
| `reactions:read` | View reactions |
| `reactions:write` | Add reactions |
| `team:read` | Get workspace info (name, domain) |
| `users:read` | View user info and avatars |

## Step 3: Enable Socket Mode

Socket Mode allows the bot to receive events without a public URL.

1. Go to **Socket Mode** in the left sidebar
2. Toggle **Enable Socket Mode** to ON
3. You'll be prompted to create an **App-Level Token**:
   - **Token Name**: e.g., "socket-token"
   - **Scopes**: Add `connections:write`
4. Click **Generate**
5. Copy the **App Token** (starts with `xapp-`)

## Step 4: Configure Event Subscriptions

1. Go to **Event Subscriptions** in the left sidebar
2. Toggle **Enable Events** to ON
3. Under **Subscribe to bot events**, add:
   - `app_mention` - When someone mentions your bot
   - `message.channels` - Messages in public channels
   - `message.groups` - Messages in private channels
   - `message.im` - Direct messages
   - `message.mpim` - Group direct messages

4. Click **Save Changes**

## Step 5: Configure App Home (Required for DMs)

This step is **required** for users to send direct messages to the bot.

1. Go to **App Home** in the left sidebar
2. Scroll to **Show Tabs** section
3. Enable **Messages Tab**
4. Check **Allow users to send Slash commands and messages from the messages tab**

> **Important:** Without this setting, users cannot open a DM conversation with the bot!

## Step 6: Create Slash Commands

1. Go to **Slash Commands** in the left sidebar
2. Click **Create New Command**
3. Create the `/bind` command:
   - **Command**: `/bind`
   - **Short Description**: Bind your account to memU
   - **Usage Hint**: `[security_code]`
4. Click **Save**

## Step 7: Install App to Workspace

1. Go to **Install App** in the left sidebar
2. Click **Install to Workspace**
3. Review permissions and click **Allow**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## Step 8: Get Signing Secret

1. Go to **Basic Information** in the left sidebar
2. Scroll to **App Credentials**
3. Copy the **Signing Secret**

## Step 9: Configure in memU

1. Open memU
2. Go to **Settings** → **Slack**
3. Enter the following:
   - **Bot Token**: The `xoxb-` token from Step 7
   - **App Token**: The `xapp-` token from Step 3
   - **Signing Secret**: From Step 8
4. Click **Connect**

## Step 10: Bind Your User Account

1. In any Slack channel or DM with the bot, type:
   ```
   /bind YOUR_SECURITY_CODE
   ```
2. The bot will confirm that your Slack account is now bound

## Step 11: Invite Bot to Channels

The bot can only see messages in channels it's been added to:

1. Go to the channel
2. Click the channel name to open details
3. Go to **Integrations** → **Apps**
4. Click **Add an App** and select your bot

Or type in the channel:
```
/invite @YourBotName
```

## Tokens Summary

| Token Type | Prefix | Purpose |
|------------|--------|---------|
| Bot Token | `xoxb-` | Authenticate API calls |
| App Token | `xapp-` | Socket Mode connection |
| Signing Secret | (hex string) | Verify request signatures |

## Troubleshooting

### Bot not connecting?
- Verify all three credentials are correct
- Ensure Socket Mode is enabled
- Check that App Token has `connections:write` scope

### Can't send DM to the bot?
This is a common issue! Make sure you have:
1. **App Home → Messages Tab** enabled (Step 5)
2. **"Allow users to send Slash commands and messages"** checked
3. `im:history`, `im:read`, `im:write` scopes added
4. `message.im` event subscribed

To open a DM with the bot:
1. Click **Apps** in the Slack sidebar
2. Find your bot and click it
3. Click **Messages** tab to start chatting

### Bot not receiving messages in channels?
- Add the bot to the channel using `/invite @bot`
- Check Event Subscriptions are enabled
- Verify `message.channels` event is subscribed
- Verify bot has required scopes

### Slash commands not working?
- Reinstall the app to workspace after adding commands
- Check the command is created in Slack App settings

### Can't send messages?
- Ensure `chat:write` scope is added
- Verify bot is in the channel

## Security Notes

- Never share your tokens or signing secret
- Rotate tokens if compromised via **OAuth & Permissions** → **Revoke Tokens**
- Use minimal scopes necessary for your use case
- Only bind accounts you trust with the security code

## Event Subscriptions vs Socket Mode

- **Socket Mode**: Recommended for development and self-hosted bots. No public URL needed.
- **Request URL**: For production apps with public endpoints. Requires HTTPS URL.

memU uses Socket Mode, so no public URL is required.

## Rate Limits

Slack has API rate limits. If you see rate limit errors:
- Reduce message frequency
- Implement exponential backoff
- Check [Slack Rate Limits](https://api.slack.com/docs/rate-limits) for details
