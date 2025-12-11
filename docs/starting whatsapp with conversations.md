# Starting WhatsApp with Conversations

This tutorial shows you how to use [Twilio Conversations](/docs/conversations) with Twilio's Sandbox for WhatsApp. Twilio controls a dedicated WhatsApp phone number that you can use to test WhatsApp messaging in Conversations.

## Prerequisites

Before you begin, make sure you have the following:

- A Twilio account—[sign up for a free account](https://www.twilio.com/try-twilio) if you need one.
- The [Twilio CLI](/docs/twilio-cli/quickstart).
- Your Account SID and Auth Token, available in the [Twilio Console](https://console.twilio.com/).

**Note:** This tutorial shows both the Conversations API approach and a more basic Messages API alternative. If you're having issues with Conversations, try the Messages API method first.

## Step 1: Opt in to the Twilio Sandbox for WhatsApp

You can test your application in a developer environment by connecting to the Twilio Sandbox for WhatsApp.

Go to the [Conversations > Try it out](https://console.twilio.com/us1/develop/conversations/tryout/whatsapp) section in the Twilio Console. Choose a use case, then send the `"join <your Sandbox keyword>"` WhatsApp message from your device to the Twilio Sandbox for a WhatsApp phone number to connect to your sandbox.

![Instructions to connect to Twilio WhatsApp sandbox by sending a message or scanning a QR code.](https://docs-resources.prod.twilio.com/b39a2b8067e566fed44a3aa36b9781c60a1172c1aaabfef4e8f5a6292e1ec847.png)

Once you've joined Twilio WhatsApp Sandbox, you'll receive a confirmation message. To disconnect from the sandbox, you can reply to the message from WhatsApp with the word "stop".

**Important:** Note down your Sandbox WhatsApp number (typically starts with +1415). You'll need this for the next steps.

## Step 2: Quick test with Messages API (Recommended first step)

Before diving into Conversations, let's verify your WhatsApp Sandbox works with a basic message:

```bash
curl 'https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json' -X POST \
--data-urlencode 'To=whatsapp:YOUR_WHATSAPP_NUMBER' \
--data-urlencode 'From=whatsapp:TWILIO_SANDBOX_NUMBER' \
--data-urlencode 'Body=Testing WhatsApp Sandbox!' \
-u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN
```

Replace:

- `YOUR_ACCOUNT_SID`: Your Account SID from the Console
- `YOUR_AUTH_TOKEN`: Your Auth Token from the Console
- `YOUR_WHATSAPP_NUMBER`: Your phone number in E.164 format (e.g., +14155238886)
- `TWILIO_SANDBOX_NUMBER`: The Sandbox number (e.g., +14155238886)

If this works, you should receive a WhatsApp message. If not, check:

- You've joined the sandbox correctly
- Your phone number format is correct (E.164)
- Your credentials are valid

## Step 3: Remove the inbound URL (Optional but recommended)

In this tutorial, we won't need to set a webhook URL for inbound messaging. To remove the existing testing webhook URL configured in the WhatsApp Sandbox's settings section, go to the [Messaging > Try it out > Send a WhatsApp message > Sandbox Settings](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn?frameUrl=%2Fconsole%2Fsms%2Fwhatsapp%2Flearn%3Fx-target-region%3Dus1) section in the Twilio Console and remove the webhook URL. Click **Save**.

Not doing so would result in a reply requesting to update the configuration for your WhatsApp Sandbox's Inbound URL when you send your first message.

## Step 4: Create a conversation

After you have your Twilio Sandbox for WhatsApp configured, create your first [Conversation](/docs/conversations/api/conversation-resource).

Let's make a Conversation using the [Twilio CLI](/docs/twilio-cli/getting-started/install) (but remember that you can choose another tool for making the API requests):

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create \
    --friendly-name "whatsapp-sandbox-test"
```

Copy the **Conversation SID** that starts with `CHXXXXXXX`. You'll use this value in the next steps.

If this command fails, verify:

- Twilio CLI is installed and authenticated (`twilio profiles:list`)
- Your account has Conversations enabled

## Step 5: Add a WhatsApp participant to the conversation

You've created a Conversation, which you can think of as a virtual space that users can join using a channel of their choice.

Next, you'll add yourself as a WhatsApp [Participant](/docs/conversations/api/conversation-participant-resource). The following code sample does this for you. You'll need to replace the following information:

- `CHXXXXXXXXXXX`: the Conversation SID.
- `YOUR_WHATSAPP_NUMBER`: your own mobile phone number in [E.164 format](/docs/glossary/what-e164).
- `TWI_SANDBOX_WA_NUMBER`: the Twilio Sandbox WhatsApp phone number in [E.164 format](/docs/glossary/what-e164).

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
    --conversation-sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --messaging-binding.address whatsapp:YOUR_WHATSAPP_NUMBER \
    --messaging-binding.proxy-address whatsapp:TWI_SANDBOX_WA_NUMBER
```

**Troubleshooting:** If you get an error about the proxy address, verify:

- You're using the correct Sandbox number
- You've successfully joined the Sandbox
- The numbers are in E.164 format

## Step 6: Add a chat participant to the conversation

For this step, you'll add a chat Participant to the Conversation (remember that you can also add an SMS Participant).

The following code sample does this for you. You'll need to replace the following information:

- `CHXXXXXXXXXX`: the Conversation SID.
- `<Chat_User_Identity>`: the identity of your chat user. In this tutorial, you will use "chat-user".

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
    --conversation-sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --identity "chat-user"
```

Conversation created. Two participants added.

You can start communicating.

## Step 7: Send a message from WhatsApp to the Sandbox number

Send a WhatsApp message to your Sandbox number. You should see it appear in the Conversation.

![WhatsApp chat with business notification and first message saying 'Hello, it's from WA'.](https://docs-resources.prod.twilio.com/b7ee0e1ee9fe509c108525c08f258fad6f4e848c545976410837cd08e957cca6.jpg)

## Step 8: Reply via Conversations API

Reply to the WhatsApp message using the Conversations API:

```bash
twilio api:conversations:v1:conversations:messages:create \
    --conversation-sid CHXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX \
    --author "chat-user" \
    --body "Hello from the Conversations API"
```

Replace `CHXXXXXXX` with your Conversation SID and add the content of the message that you'd like to send.

![WhatsApp chat showing a message from WA and a reply with a waving hand emoji.](https://docs-resources.prod.twilio.com/5860a07f81948101bc4b8d288c7cbbf5a4874737e949eaaeb53a97e08b617ada.jpg)

## Alternative: Using Messages API directly

If you're having issues with the Conversations approach, you can send messages directly using the Messages API:

```bash
# Using Twilio CLI
twilio api:core:messages:create \
    --to whatsapp:YOUR_WHATSAPP_NUMBER \
    --from whatsapp:TWILIO_SANDBOX_NUMBER \
    --body "Direct message via Messages API"

# Or using curl
curl 'https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json' -X POST \
--data-urlencode 'To=whatsapp:YOUR_WHATSAPP_NUMBER' \
--data-urlencode 'From=whatsapp:TWILIO_SANDBOX_NUMBER' \
--data-urlencode 'Body=Direct message via Messages API' \
-u YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN
```

## Step 9: Monitor your conversations

To verify messages are flowing through Conversations, check [Monitor > Logs > Messaging](https://console.twilio.com/us1/monitor/logs/sms) in the Console.

![Messages tab showing two entries from WhatsApp and chat user.](https://docs-resources.prod.twilio.com/6bb13bd6cf0e87c02b790a533eada599ed9d95e58093fcad029f164fa530ca80.png)

## Troubleshooting common issues

### "Conversation not found" errors

- Verify your Conversation SID is correct
- Check that the Conversation was created successfully

### WhatsApp messages not appearing

- Ensure you've joined the Sandbox correctly
- Verify the webhook URL is cleared in Sandbox settings
- Check that participants were added successfully

### Authentication errors

- Verify your Account SID and Auth Token
- Ensure Twilio CLI is authenticated: `twilio profiles:list`

### Participant creation failures

- Double-check phone number format (E.164)
- Verify you're using the correct Sandbox number
- Ensure you've joined the Sandbox

## What's next?

You have learned how to connect Twilio Sandbox for WhatsApp with Conversations. Next steps:

- Learn more about [Using WhatsApp with Conversations](/docs/conversations/using-whatsapp-conversations)
- Check out our [Conversations Quickstart](/docs/conversations/quickstart)
- Explore [WhatsApp Business API features](/docs/whatsapp)
- Set up [production WhatsApp messaging](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates)
