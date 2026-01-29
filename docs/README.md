# memU Documentation

Welcome to the memU documentation. This guide will help you set up and configure bots for various messaging platforms.

## Bot Setup Guides

| Platform | Guide | Difficulty |
|----------|-------|------------|
| Telegram | [telegram-bot-setup.md](./telegram-bot-setup.md) | ⭐ Easy |
| Discord | [discord-bot-setup.md](./discord-bot-setup.md) | ⭐⭐ Medium |
| Slack | [slack-bot-setup.md](./slack-bot-setup.md) | ⭐⭐⭐ Advanced |

## Quick Start

1. **Choose a platform** and follow its setup guide
2. **Create a bot** on the platform's developer portal
3. **Configure credentials** in memU Settings
4. **Bind your account** using the `/bind` command

## Platform Comparison

| Feature | Telegram | Discord | Slack |
|---------|----------|---------|-------|
| Setup Complexity | Simple | Medium | Complex |
| Tokens Required | 1 | 1 | 3 |
| Public URL Needed | No | No | No (Socket Mode) |
| Group Support | ✅ | ✅ | ✅ |
| File Sharing | ✅ | ✅ | ✅ |
| Rich Messages | Markdown | Embeds | Blocks |

## Common Concepts

### Security Code
The security code is used to bind your messaging account to memU. Set it in **Settings** → **Security**.

### Binding
Binding links your messaging account to memU, allowing the bot to respond to your messages. Use `/bind YOUR_CODE` in any chat with the bot.

### Proxy Support
All platforms support SOCKS5 and HTTP proxies. Configure in **Settings** → **Proxy**.

## Troubleshooting

If you encounter issues:
1. Check the platform-specific troubleshooting section
2. Verify all credentials are correct
3. Ensure required permissions/scopes are enabled
4. Check memU logs for error messages

## Security Best Practices

- Use strong, unique security codes
- Never share bot tokens publicly
- Regenerate tokens if compromised
- Only bind accounts you control
- Review bot permissions regularly
