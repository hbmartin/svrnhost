# The WhatsApp Business Platform with Twilio: Best Practices and FAQs

With Twilio Programmable Messaging, you can integrate WhatsApp messaging into your web application. Although these integrations are generally straightforward, developers may benefit from guidance on how to best utilize the Programmable Messaging API specifically for WhatsApp. This document provides answers to frequently asked questions and presents best practices for integrating the WhatsApp Business Platform with Twilio.

## General

- **What are the requirements for a business to be approved for WhatsApp?**

  WhatsApp requires compliance with the [WhatsApp Business Solution Terms](https://www.whatsapp.com/legal/business-solution-terms), the [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy), and its [Commerce Policy](https://www.whatsapp.com/legal/commerce-policy#policies_for_whatsapp_commerce_features). As part of the approval process, the business and use case will be considered to ensure the usage aligns with the above guidelines.

- **How do I improve marketing delivery rates?**

To achieve higher marketing delivery rates and improved optimizations, you can enable Marketing Messages API on your account. To get started, sign the Marketing Messages API Terms of Service in your WhatsApp Business Account. You can find the option to set up Marketing Messages API in the Overview section under Alerts. No code changes are required to use Marketing Messages API on Twilio.

- **What is the cost of the WhatsApp service?**

  All WhatsApp messages incur a per-message fee for use of Twilio's API, except for Flex, which has a [separate pricing structure](https://www.twilio.com/en-us/flex/pricing). The per-message fee depends on which Twilio API you use to send WhatsApp messages, such as Programmable Messaging or Verify.

  Meta also charges fees for some messages, and these are passed on to you by Twilio. Meta's fees are generally based on template categories: utility, marketing, or authentication. All Meta fees vary by country, based on the end user's country code.

  For more information about fees and to estimate costs, see [Twilio's WhatsApp pricing page](https://www.twilio.com/en-us/whatsapp/pricing) and [Meta's fee details](https://help.twilio.com/articles/360037672734-How-Much-Does-it-Cost-to-Send-and-Receive-WhatsApp-Messages-with-Twilio-).

- **How can I manage separate access lists to Sandbox and to the live numbers on my account?**

  If you need to segment traffic and manage separate access lists, we recommend that you split the traffic between different Twilio accounts. This approach provides better control over each use case and allows you to manage separate access lists for each account.

- **What is the MPS (Messages Per Second) limit for outbound WhatsApp messages?**

  The WhatsApp Business Platform with Twilio supports a messaging throughput of 80 MPS (messages per second) by default per WhatsApp sender for outbound traffic. This throughput applies to both text-only messages and messages containing media files. The text-only throughput for a WhatsApp sender can be increased up to a maximum of 400 MPS upon request and pending approval after review of the business's messaging requirements. Media throughput cannot be increased further at this time.

  Messages sent at rates exceeding the configured throughput for the sender will be placed in a message queue and dequeued for delivery at the set throughput rate. Messages can remain in the queue for up to four hours. Messages that remain in the queue for more than four hours will fail. New messages that would cause the queue to back up beyond the four-hour limit will be rejected and fail.

  - If you require sending messages at high MPS for more than a few minutes, please [contact the Twilio support team](https://help.twilio.com) for guidance and best practices prior to your campaign.

  Factors that may lead to lower throughput include:

  - Sending large media files.
  - Sending high volumes of unique media files to each recipient.
  - Sending messages containing URLs to websites with long load times.
  - Receiving concurrent inbound messages on the same WhatsApp number that is sending outbound notifications.
  - High network latency between servers and recipient users.

  If you need higher MPS than what is available per sender, you can use [Messaging Services](/docs/messaging/services#scaler). Messaging Services allow you to distribute high message volumes across multiple senders within a messaging service. Refer to our [article on Scaling WhatsApp](https://www.twilio.com/blog/scaling-whatsapp-business-platform-part-1) for additional best practices.

## Sandbox

- **Why am I getting a message "your number is not associated with the sandbox channel"?**

  Ensure that you have carefully followed the instructions in the [Using Phone Numbers with WhatsApp](/docs/whatsapp/api#using-twilio-phone-numbers-with-whatsapp) section of the Programmable Messaging API Reference and Overview. You need to join the sandbox and enable one of your Twilio numbers with WhatsApp.

- **Why am I getting a message "Twilio could not find a Channel with the specified From address" when trying to send a message?**

  There are two common reasons why you are seeing this error:

  - The `From` address in your Programmable Messaging API request is incorrect. To send messages using WhatsApp, the `From` address should be `whatsapp:<sandbox phone number>`. This can be found on the [sandbox page](https://www.twilio.com/console/messaging/whatsapp/sandbox).
  - You are trying to send a message from an account that does not have the sandbox enabled. [Activate the sandbox](https://www.twilio.com/console/sms/whatsapp) before sending a message.

- **I joined the Twilio sandbox for WhatsApp and got a "Twilio Sandbox. You are all set! The sandbox can send/receive messages..." reply. Can I change the message?**

  This reply is part of the sandbox implementation and cannot be changed. Once you get your own number, you are free to set your own message. Note that WhatsApp requires brands to receive customer opt-in before sending messages on WhatsApp.

- **My outbound message from the sandbox was not delivered. Why?**

  There are two reasons why a message sent from the Twilio Sandbox for WhatsApp would fail to be delivered:

  - You are trying to send a message to a user who has not joined your sandbox. Refer to the instructions for [getting started with the sandbox](/docs/whatsapp/sandbox), including how users can join your sandbox.
  - You are sending a free-form message to the user outside the customer service window. A customer service window lasts for 24 hours after the last inbound message you receive from a user. Outside a customer service window, you may only send a pre-approved template message to the user. Any message that does not match a pre-approved template will be sent by Twilio as a free-form message. You can find a list of templates pre-approved for the sandbox in the [templates pre-registered for the Sandbox docs](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates#templates-pre-registered-for-the-sandbox).

## API-specific questions

- **Can I check if a user's phone number is enabled for WhatsApp?**

  Every time you send a WhatsApp message, Twilio automatically checks if the number is enabled for WhatsApp and will fail the message with [error code 63003](/docs/api/errors/63003) if the destination is found to be invalid. WhatsApp has strict guidelines regarding availability checks. When a number is found to be a valid WhatsApp number, you are required to send a message to prevent your account from being marked for lower-quality traffic. WhatsApp does not permit exposing the capability check or using it independently of sending a message.

- **What formatting options do I have in WhatsApp?**

  Refer to the [guide to rich messaging features](/docs/whatsapp/message-features), including formatting options in the WhatsApp Business Platform with Twilio.

- **Can I send messages to WhatsApp groups or manage groups?**

  WhatsApp deprecated the Groups API in April 2020. Twilio offers a group messaging solution using the Conversations API. You can find sample code in Code Exchange: [WhatsApp Group Messaging](https://www.twilio.com/code-exchange/whatsapp-group-messaging). For more information, refer to [Twilio Conversations](/docs/conversations).

- **Does the WhatsApp Business Platform with Twilio support read receipts?**

  Twilio supports read receipts on business-initiated messages. Currently, Twilio does not support read receipts for inbound (user-initiated) WhatsApp messages. This means it is not possible for the business to set the status of a message it received to "read" (i.e., changing the checkmark color on the end-user's application).

## Live Senders (WhatsApp-enabled phone numbers)

- **What use cases are supported by WhatsApp?**

  WhatsApp supports user-initiated and business-initiated messaging. With user-initiated messaging, the first message is received by the business from the user. This opens a conversation in which the business can reply with free-form messages. The conversation remains open for 24 hours following the last message received from the user.

  Business-initiated messaging is when the business sends the first message to the user or replies to the user more than 24 hours after the last message received from the user. This typically applies to notification use cases. Business-initiated messaging requires the use of pre-approved templates.

- **What account type options do I have for my business in WhatsApp? How do they appear in the app?**

  Information about available WhatsApp account types can be found in the [WhatsApp API documentation](/docs/whatsapp/api). You can apply for an Official Business Account once your number is live and the Meta Business Manager account that is linked to your WhatsApp number is set to `Verified` status.

- **What kind of phone numbers can be enabled for WhatsApp?**

  WhatsApp requires a phone number to be E.164-compliant and able to receive a one-time PIN (OTP) code via SMS or phone call to enable the service. This includes 10-digit long codes, local numbers, national numbers, and toll-free numbers in most regions. Most numbers sold on Twilio are supported. Short codes are not supported. More information can be found in the [Which Twilio Phone Numbers are Compatible with WhatsApp](https://help.twilio.com/hc/en-us/articles/360026678054-Which-Twilio-Phone-Numbers-are-Compatible-with-WhatsApp-) article.

## Media support

- **How can I send and receive media on WhatsApp? What type of media is supported?**

  You can find information about how to send and receive media messages and supported media on WhatsApp in the [Sending and Receiving Media with WhatsApp Messaging](https://help.twilio.com/hc/en-us/articles/360017961894-Sending-and-Receiving-Media-with-WhatsApp-Messaging-on-Twilio-Beta-) article. We also have a more detailed, [step-by-step tutorial for sending and receiving media on WhatsApp](/docs/whatsapp/tutorial/send-and-receive-media-messages-twilio-api-whatsapp).

## Troubleshooting WhatsApp error codes

- **I'm getting error code 63020 when trying to send messages on WhatsApp. What should I do?**

  [Error 63020](/docs/api/errors/63020) indicates that you have not yet accepted the invitation from Twilio to send messages on your behalf for the business. Go to your Meta Business Manager account and accept the invitation to be able to send and receive messages.

- **Everything went well until I started receiving error code 63018 when I try to send messages. Why?**

  [Error 63018](/docs/api/errors/63018) indicates that you have hit the rate limit set on your WhatsApp number. You can learn more about WhatsApp's rate limit and how to plan your rollout around it in the [WhatsApp Rate Limiting](https://help.twilio.com/hc/en-us/articles/360024008153-WhatsApp-Rate-Limiting) article.
