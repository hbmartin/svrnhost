# Using Buttons In WhatsApp

## What are WhatsApp buttons?

WhatsApp lets you add buttons to [message templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates). There are two types of buttons: **Quick replies** and **Call to action** buttons. These buttons open up many opportunities for businesses worldwide to engage with their customers on WhatsApp, one of the most popular messaging applications.

Quick replies let businesses define buttons that users can tap to respond. When a Quick reply is tapped, a message containing the button text is sent in the conversation.

Call to action buttons trigger a phone call or open a website when tapped. At this time, WhatsApp does not support deep links.

To use buttons, you need to submit them as part of a message template to WhatsApp. Once approved, templates containing buttons can be sent by sending the message text in your API request.

## Creating templates with buttons

To use buttons, you need to submit a template that contains the buttons. Go to the Twilio console, navigate to **[Messaging > Content Template Builder](/console/sms/content-template-builder)**, and click the **Create new** button. Here, you need to submit a message template containing buttons.

The content types that can contain buttons are:

- Call to action
- Quick reply
- Card
- Carousel
- WhatsApp Card

The following buttons are available:

- Quick reply
- URL
- Phone Call
- WhatsApp Voip call
- Copy Coupon Code

All buttons can be used in session without approval except copy coupon code. Coupons always need approval.

For more information, see [Sending Notifications with Templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates#set-up-whatsapp-message-templates-in-your-twilio-account) and [Content Types Overview](/docs/content/content-types-overview).

![WhatsApp button template with options for call to action, visit website, and phone number.](https://docs-resources.prod.twilio.com/fc00ea613c6c3aa39f055732a7d7ed5f1bbe44b9f661f17498a0acda5a81ea3e.png)

## Sending templates with buttons

Once your template with buttons has been approved, you can send buttons as part of your WhatsApp messages. To send a button, send the template like any other Content Template. To see how to send Content Templates, see [Send Templates Created with Content Template Builder](/docs/content/send-templates-created-with-the-content-template-builder).

| ![WhatsApp chat with Perspective Coffee showing order confirmation and call-to-action buttons for payment.](https://docs-resources.prod.twilio.com/19665efddd53aa00027d790f33a503d0fc679663a836079b65e7fa68e1457300.png) | ![WhatsApp chat showing Twilio passcode 1112223 with encryption notice.](https://docs-resources.prod.twilio.com/18ad792a63342b5c0ebc01bf03017b79e4b373d86ed9aeaf22424f61b164b290.png) |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Call to action buttons_                                                                                                                                                                                                 | _Quick reply button_                                                                                                                                                                  |

> \[!NOTE]
>
> Quick reply buttons can be sent without approval within [a 24 hour session](/docs/whatsapp/key-concepts#the-24-hour-window-or-24-hour-session). To send quick reply buttons, create the template but do not submit it for approval. You can then send the quick reply template directly without approval in a 24 hour session.

Sending Content Templates

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createMessage() {
  const message = await client.messages.create({
    contentSid: "HXXXXXXXXX",
    contentVariables: JSON.stringify({ 1: "Name" }),
    from: "whatsapp:+15551234567",
    messagingServiceSid: "MGXXXXXXXX",
    to: "whatsapp:+18551234567",
  });

  console.log(message.body);
}

createMessage();
```


```json
{
  "account_sid": "ACXXXXXXXXX",
  "api_version": "2010-04-01",
  "body": "Hello! 👍",
  "date_created": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_sent": "Thu, 24 Aug 2023 05:01:45 +0000",
  "date_updated": "Thu, 24 Aug 2023 05:01:45 +0000",
  "direction": "outbound-api",
  "error_code": null,
  "error_message": null,
  "from": "whatsapp:+15551234567",
  "num_media": "0",
  "num_segments": "1",
  "price": null,
  "price_unit": null,
  "messaging_service_sid": "MGXXXXXXXX",
  "sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "queued",
  "subresource_uris": {
    "media": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json"
  },
  "to": "whatsapp:+18551234567",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

## Receiving Quick replies

When end-users tap on one of your Quick replies, this automatically triggers a message that is sent to your business with the button text. If you have a webhook configured for incoming messages to the WhatsApp sender that the Quick reply was sent to, then you can get the text of the button tapped in the `ButtonText` parameter from the callback. Additionally you can set and get the unique identifier for each quick reply button using the id field. For more information, see [Twilio's Webhook Requests](/docs/messaging/guides/webhook-request#whatsapp-specific-parameters).

## Additional information

- Message templates with buttons incur standard [template charges](https://developers.facebook.com/docs/whatsapp/pricing/) wherever applicable.
- The Conversations API, Flex, and Studio support buttons.

  - To include a button in all cases except WhatsApp, send a message using the Content SID.
  - To include a buttons made with a WhatsApp Template, send a message with a text body that matches the corresponding template with buttons.
