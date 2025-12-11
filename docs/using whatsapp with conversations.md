# Using WhatsApp with Conversations

WhatsApp is increasingly the world's #1 conversational messaging platform as well as an absolutely critical engagement tool across South America, Middle East, Africa and many parts of Europe and Asia. Twilio Conversations supports WhatsApp out of the box and can help you address a number of patterns:

- **Delivery Coordination:** Let your drivers reach out to the customer to make sure the last 100 yards of each delivery are successful.
- **Clienteling:** Allow your employees to have long-term relationships (e.g. personal shoppers, wealth managers, or real estate agents) with your customers without using their personal devices.
- **Masked Communication:** Facilitate communication between your employees and your customers without sharing private numbers.

This guide will show you how to set up a few common patterns that pair WhatsApp with other channels.

## Prerequisites

> \[!NOTE]
>
> WhatsApp onboarding generally takes 1-2 weeks. WhatsApp has a thorough vetting process that requires business verification in the Meta Business Manager in order to protect the WhatsApp ecosystem.
>
> We advise planning accordingly when setting up your WhatsApp Sender for Twilio. For more information, see [Register WhatsApp senders using Self Sign-up](/docs/whatsapp/self-sign-up) or [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program).

WhatsApp is a highly-regulated channel, requiring documentation and approval from Meta to get your business started. See [Register WhatsApp senders using Self Sign-up](/docs/whatsapp/self-sign-up) or [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program).

### Get your WhatsApp templates approved

> \[!NOTE]
>
> The last section of the tutorial uses templates to initiate contact between
> two separate WhatsApp participants. If you follow the steps chronologically,
> you will still be able to complete the tutorial because you will have opted
> into the WhatsApp's 24-hour window. However, the screenshots will looks
> lightly different from what you see in the WhatsApp interface.

Depending on your use-case, you may need to secure some [approved WhatsApp templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates). This is specifically required if you want to _send_ a message to a new user on WhatsApp, or _send_ a message more than 24 hours after the last response.

**Note:** If your use case can function such that you _always receive WhatsApp messages first_ from your customers, you can skip the template registration step.

Now, you're ready to go!

## Cross-Channel Masking: Connecting WhatsApp to SMS

SMS is the easiest channel to connect to WhatsApp in a Twilio Conversation. To do this we'll use:

- A Twilio SMS-capable phone number (hereafter "TWI-SMS-NUMBER")
- Your Twilio WhatsApp number (hereafter "TWI-WA-NUMBER")
- The [Twilio CLI](/docs/twilio-cli/quickstart)

We recommend the Twilio CLI for experimenting, but these guides will work in any language in Twilio. Pick your favorite on the right and follow along.

Let's get down to it; our SMS-to-WhatsApp conversation will take four steps to set up.

### Step 1. Create a Conversation

Create a Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversation() {
  const conversation = await client.conversations.v1.conversations.create({
    friendlyName: "SMS-to-WhatsApp Example",
  });

  console.log(conversation.sid);
}

createConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations.create(
    friendly_name="SMS-to-WhatsApp Example"
)

print(conversation.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation =
            await ConversationResource.CreateAsync(friendlyName: "SMS-to-WhatsApp Example");

        Console.WriteLine(conversation.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.creator().setFriendlyName("SMS-to-WhatsApp Example").create();

        System.out.println(conversation.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParams{}
	params.SetFriendlyName("SMS-to-WhatsApp Example")

	resp, err := client.ConversationsV1.CreateConversation(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1->conversations->create([
    "friendlyName" => "SMS-to-WhatsApp Example",
]);

print $conversation->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations
               .create(friendly_name: 'SMS-to-WhatsApp Example')

puts conversation.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create \
   --friendly-name "SMS-to-WhatsApp Example"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
--data-urlencode "FriendlyName=SMS-to-WhatsApp Example" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "friendly_name": "SMS-to-WhatsApp Example",
  "unique_name": "unique_name",
  "attributes": "{ \"topic\": \"feedback\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "state": "inactive",
  "timers": {
    "date_inactive": "2015-12-16T22:19:38Z",
    "date_closed": "2015-12-16T22:28:38Z"
  },
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

### Step 2: Create the WhatsApp Participant

Create the WhatsApp Participant

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("CHxxxx")
    .participants.create({
      "messagingBinding.address": "whatsapp:YOUR_WHATSAPP_NUMBER",
      "messagingBinding.proxyAddress": "whatsapp:TWI_WA_NUMBER",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "CHxxxx"
).participants.create(
    messaging_binding_address="whatsapp:YOUR_WHATSAPP_NUMBER",
    messaging_binding_proxy_address="whatsapp:TWI_WA_NUMBER",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "whatsapp:YOUR_WHATSAPP_NUMBER",
            messagingBindingProxyAddress: "whatsapp:TWI_WA_NUMBER",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("CHxxxx")
                                      .setMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
                                      .setMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
	params.SetMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")

	resp, err := client.ConversationsV1.CreateConversationParticipant("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->participants->create([
        "messagingBindingAddress" => "whatsapp:YOUR_WHATSAPP_NUMBER",
        "messagingBindingProxyAddress" => "whatsapp:TWI_WA_NUMBER",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('CHxxxx')
              .participants
              .create(
                messaging_binding_address: 'whatsapp:YOUR_WHATSAPP_NUMBER',
                messaging_binding_proxy_address: 'whatsapp:TWI_WA_NUMBER'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid CHxxxx \
   --messaging-binding.address whatsapp:YOUR_WHATSAPP_NUMBER \
   --messaging-binding.proxy-address whatsapp:TWI_WA_NUMBER
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=whatsapp:YOUR_WHATSAPP_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=whatsapp:TWI_WA_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{ \"role\": \"driver\" }",
  "messaging_binding": {
    "type": "sms",
    "address": "+15558675310",
    "proxy_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 3: Create the SMS Participant

Create the SMS Participant

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("CHxxxx")
    .participants.create({
      "messagingBinding.address": "YOUR_SMS_NUMBER",
      "messagingBinding.proxyAddress": "TWI_SMS_NUMBER",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "CHxxxx"
).participants.create(
    messaging_binding_address="YOUR_SMS_NUMBER",
    messaging_binding_proxy_address="TWI_SMS_NUMBER",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "YOUR_SMS_NUMBER",
            messagingBindingProxyAddress: "TWI_SMS_NUMBER",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("CHxxxx")
                                      .setMessagingBindingAddress("YOUR_SMS_NUMBER")
                                      .setMessagingBindingProxyAddress("TWI_SMS_NUMBER")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("YOUR_SMS_NUMBER")
	params.SetMessagingBindingProxyAddress("TWI_SMS_NUMBER")

	resp, err := client.ConversationsV1.CreateConversationParticipant("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->participants->create([
        "messagingBindingAddress" => "YOUR_SMS_NUMBER",
        "messagingBindingProxyAddress" => "TWI_SMS_NUMBER",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('CHxxxx')
              .participants
              .create(
                messaging_binding_address: 'YOUR_SMS_NUMBER',
                messaging_binding_proxy_address: 'TWI_SMS_NUMBER'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid CHxxxx \
   --messaging-binding.address YOUR_SMS_NUMBER \
   --messaging-binding.proxy-address TWI_SMS_NUMBER
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=YOUR_SMS_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=TWI_SMS_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{ \"role\": \"driver\" }",
  "messaging_binding": {
    "type": "sms",
    "address": "+15558675310",
    "proxy_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

### Step 4: Send a message from WhatsApp

Because you've set up this conversation to proxy with SMS, you'll see the messages flowing back and forth automatically between your two channels.

**Note**: The WhatsApp user kicks off this conversation by sending the first message. By starting from an inbound WhatsApp message, we've avoided any need to use WhatsApp Templates to start the Conversation. These messages and media will flow just fine for the next 24 hours.

![Comparison of WhatsApp and SMS messages with identical content and .](https://docs-resources.prod.twilio.com/fa093fc9213816f009c06439e2322c500e25cdddc8e39b875ab3f7b18ccc15d6.png)

## Masked Communication: Connecting Two WhatsApp Participants

When you connect two WhatsApp participants, you'll have to solve two business problems:

1. **Who is speaking with whom?**\
   This is probably the bread-and-butter of your business idea: if you're a two-sided marketplace, you're probably connecting a buyer and a seller (or a passenger and a rider). The buyer is the most critical personality: the brand they see in WhatsApp is important and must establish enough trust to proceed with the conversation. When you create your WhatsApp Business Profile, keep that buyer personality in mind first.
2. **How will you get opt-in from both participants?**\
   Unsolicited outbound messages to WhatsApp are highly restricted. Until your customer replies, you can only send messages conforming to approved templates. In this scenario, both sides are on WhatsApp, so we will need to use one of those templates to get the conversation moving.

We'll start by setting up the Conversation and later show how to use templates to improve the customer experience.

### Setting Up the Conversation

We'll need the following to set up our WhatsApp-to-WhatsApp Conversation:

1. A Twilio WhatsApp number; we'll call this "TWI_WA_NUMBER." You could use more than one, but it's not necessary.
2. Two consumer WhatsApp accounts. Choose yourself and a friend who won't mind. These are typically your personal device numbers.
3. [The Twilio CLI](https://twil.io/cli).

> \[!WARNING]
>
> If you're going through this guide in chronological order and re-using your WhatsApp numbers to test out all of the use cases, you should remove the previous Conversation first. Each number pair (twilio+personal) can only appear in one conversation at a time.
>
> ```bash
> twilio api:conversations:v1:conversations:remove --sid CHxxxx
> ```

With that, connecting two WhatsApp participants in a Conversation will take five steps:

Step 1: Create the Conversation

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversation() {
  const conversation = await client.conversations.v1.conversations.create();

  console.log(conversation.sid);
}

createConversation();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

conversation = client.conversations.v1.conversations.create()

print(conversation.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var conversation = await ConversationResource.CreateAsync();

        Console.WriteLine(conversation.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.Conversation;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Conversation conversation = Conversation.creator().create();

        System.out.println(conversation.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParams{}

	resp, err := client.ConversationsV1.CreateConversation(params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$conversation = $twilio->conversations->v1->conversations->create();

print $conversation->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

conversation = @client
               .conversations
               .v1
               .conversations
               .create

puts conversation.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:create
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "chat_service_sid": "ISaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "messaging_service_sid": "MGaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "friendly_name": "friendly_name",
  "unique_name": "unique_name",
  "attributes": "{ \"topic\": \"feedback\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "state": "inactive",
  "timers": {
    "date_inactive": "2015-12-16T22:19:38Z",
    "date_closed": "2015-12-16T22:28:38Z"
  },
  "bindings": {},
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "participants": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants",
    "messages": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages",
    "webhooks": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks",
    "export": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Export"
  }
}
```

Steps 2 and 3: Add two different WhatsApp Participants

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationParticipant() {
  const participant = await client.conversations.v1
    .conversations("CHxxxx")
    .participants.create({
      "messagingBinding.address": "whatsapp:YOUR_WHATSAPP_NUMBER",
      "messagingBinding.proxyAddress": "whatsapp:TWI_WA_NUMBER",
    });

  console.log(participant.accountSid);
}

createConversationParticipant();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

participant = client.conversations.v1.conversations(
    "CHxxxx"
).participants.create(
    messaging_binding_address="whatsapp:YOUR_WHATSAPP_NUMBER",
    messaging_binding_proxy_address="whatsapp:TWI_WA_NUMBER",
)

print(participant.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var participant = await ParticipantResource.CreateAsync(
            messagingBindingAddress: "whatsapp:YOUR_WHATSAPP_NUMBER",
            messagingBindingProxyAddress: "whatsapp:TWI_WA_NUMBER",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(participant.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Participant;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Participant participant = Participant.creator("CHxxxx")
                                      .setMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
                                      .setMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")
                                      .create();

        System.out.println(participant.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationParticipantParams{}
	params.SetMessagingBindingAddress("whatsapp:YOUR_WHATSAPP_NUMBER")
	params.SetMessagingBindingProxyAddress("whatsapp:TWI_WA_NUMBER")

	resp, err := client.ConversationsV1.CreateConversationParticipant("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$participant = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->participants->create([
        "messagingBindingAddress" => "whatsapp:YOUR_WHATSAPP_NUMBER",
        "messagingBindingProxyAddress" => "whatsapp:TWI_WA_NUMBER",
    ]);

print $participant->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

participant = @client
              .conversations
              .v1
              .conversations('CHxxxx')
              .participants
              .create(
                messaging_binding_address: 'whatsapp:YOUR_WHATSAPP_NUMBER',
                messaging_binding_proxy_address: 'whatsapp:TWI_WA_NUMBER'
              )

puts participant.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:participants:create \
   --conversation-sid CHxxxx \
   --messaging-binding.address whatsapp:YOUR_WHATSAPP_NUMBER \
   --messaging-binding.proxy-address whatsapp:TWI_WA_NUMBER
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Participants" \
--data-urlencode "MessagingBinding.Address=whatsapp:YOUR_WHATSAPP_NUMBER" \
--data-urlencode "MessagingBinding.ProxyAddress=whatsapp:TWI_WA_NUMBER" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "identity": null,
  "attributes": "{ \"role\": \"driver\" }",
  "messaging_binding": {
    "type": "sms",
    "address": "+15558675310",
    "proxy_address": "+15017122661"
  },
  "role_sid": "RLaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Participants/MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "last_read_message_index": null,
  "last_read_timestamp": null
}
```

#### Step 4: Send a message from one side

From your phone, send the first message in WhatsApp. Send the message to your TWI_WA_NUMBER (not directly to your friend's number.)

#### Step 5: Send a message from the other side

Have your good-natured friend send a message to your TWI_WA_NUMBER (not directly to your phone number).

![WhatsApp chat showing late opt-in for courier communication.](https://docs-resources.prod.twilio.com/7ae51b88203d52a2c108f6d0c843cc15a4063ee6e2b7c73f3203b9a3e31e6b4e.png)

Congratulations, it's working!

… Mostly. You may notice that after steps four and five, you have two _different_ conversations ongoing. After this awkward introduction, everything proceeds as expected, but that's not the professional experience we want.

In this scenario, both WhatsApp-based parties must reply before the Twilio can send outbound messages to both parties. Receiving an incoming message from both Conversation participants kicks off the "24-hour session" in which Twilio can send outbound free-form WhatsApp messages.

### Starting More Professionally: Using Template Messages

> \[!WARNING]
>
> WhatsApp templates need to be submitted and approved before they are effective. Before you proceed to below, learn how to [create WhatsApp templates and submit them for approval.](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates#creating-message-templates-and-submitting-them-for-approval) Once your templates are approved, use the appropriate body text in the steps below.
>
> **Note**: Without approved WhatsApp templates, these outbound messages will be swallowed by the system.
>
> If you have followed the tutorial chronologically, you can complete the tutorial because you and your good-natured friend have opted into receiving WhatsApp messages for 24 hours. However, the screenshots will differ from what you see in the WhatsApp interface.

Let's carry the example above a little further, and use approved [WhatsApp Template Messages](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates) to make it happen. We're going to pick two template messages that we've already gotten approved:

- A templated message that our food courier will understand
- A templated message that will invite the customer to opt into the contact.

```csharp
TEMPLATE 1:
Hello {{1}}, your food delivery is almost there but {{2}} (your rider) needs help finding your door. Are you willing to chat with them?

TEMPLATE 2:
Your customer has agreed to chat over WhatsApp to get this delivery sorted. You're now connected. Say hello!
```

We'll send these messages one after another, waiting for a response from the first before sending the second.

Using templates to smooth out our customer experience, let's follow two more steps:

Step 6: Invite the Customer to Engage.

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationMessage() {
  const message = await client.conversations.v1
    .conversations("CHxxxx")
    .messages.create({
      author: "whatsapp:COURIER_WA_NUMBER",
      body: "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
    });

  console.log(message.accountSid);
}

createConversationMessage();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

message = client.conversations.v1.conversations("CHxxxx").messages.create(
    author="whatsapp:COURIER_WA_NUMBER",
    body="Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
)

print(message.account_sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var message = await MessageResource.CreateAsync(
            author: "whatsapp:COURIER_WA_NUMBER",
            body: "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
            pathConversationSid: "CHxxxx");

        Console.WriteLine(message.AccountSid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Message;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Message message = Message.creator("CHxxxx")
                              .setAuthor("whatsapp:COURIER_WA_NUMBER")
                              .setBody("Hello Robert, your food delivery is almost there but Alicia (your rider) needs "
                                       + "help finding your door. Are you willing to chat with them?")
                              .create();

        System.out.println(message.getAccountSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationMessageParams{}
	params.SetAuthor("whatsapp:COURIER_WA_NUMBER")
	params.SetBody("Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?")

	resp, err := client.ConversationsV1.CreateConversationMessage("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.AccountSid != nil {
			fmt.Println(*resp.AccountSid)
		} else {
			fmt.Println(resp.AccountSid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$message = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->messages->create([
        "author" => "whatsapp:COURIER_WA_NUMBER",
        "body" =>
            "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
    ]);

print $message->accountSid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

message = @client
          .conversations
          .v1
          .conversations('CHxxxx')
          .messages
          .create(
            author: 'whatsapp:COURIER_WA_NUMBER',
            body: 'Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?'
          )

puts message.account_sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:messages:create \
   --conversation-sid CHxxxx \
   --author whatsapp:COURIER_WA_NUMBER \
   --body "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?"
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Messages" \
--data-urlencode "Author=whatsapp:COURIER_WA_NUMBER" \
--data-urlencode "Body=Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "sid": "IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "body": "Hello Robert, your food delivery is almost there but Alicia (your rider) needs help finding your door. Are you willing to chat with them?",
  "media": null,
  "author": "whatsapp:COURIER_WA_NUMBER",
  "participant_sid": "MBaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "attributes": "{ \"importance\": \"high\" }",
  "date_created": "2015-12-16T22:18:37Z",
  "date_updated": "2015-12-16T22:18:38Z",
  "index": 0,
  "delivery": {
    "total": 2,
    "sent": "all",
    "delivered": "some",
    "read": "some",
    "failed": "none",
    "undelivered": "none"
  },
  "content_sid": null,
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "links": {
    "delivery_receipts": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Receipts",
    "channel_metadata": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/IMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/ChannelMetadata"
  }
}
```

The following is what the customer will see after you send the first templated message as the courier/rider:

![Chat confirming food delivery and connecting customer with rider for assistance.](https://docs-resources.prod.twilio.com/b8c226db096ccf7f3290de93ebf314c40c2babd751df2fd50ad050aaa8f47efd.png)

You'll notice when you do this that the customer receives a message, but the courier does not. We're using the rules of WhatsApp's 24-hour opt-in window in our favor: securing one participant's opt-in (from the customer) before we reach out to the other (the courier).

In the picture above, you notice that we included an automated reply: "Great! Just a moment…" This picture is a step ahead. To actually execute this — and at the same time to opt-in our courier — we're going to need a Twilio function and a Conversations webhook.

#### Create a Twilio Function to send the templates

Let's start with the former.

First, navigate to the [Twilio Functions section of the Console](https://www.twilio.com/console/functions/) and click on "**Configure**." Confirm that the version listed for the [twilio NPM module is up-to-date](https://www.npmjs.com/package/twilio), such as `3.66.1` or higher.

![Twilio Functions environment variables and npm dependencies with Twilio version 3.66.1 highlighted.](https://docs-resources.prod.twilio.com/46c1be173d59523d19a047c5f40dd7cacab36b6ffaddbd4940adae5315f4480c.png)

Next, [create a Twilio Function in the console](https://www.twilio.com/console/functions/manage) with the following code, which will set us up to capture [the onMessageAdded event](/docs/conversations/conversations-webhooks).

```javascript
exports.handler = function (context, event, callback) {
  const customer = event.Author;
  let thisConversation = context
    .getTwilioClient()
    .conversations.v1.conversations.get(event.ConversationSid);

  // This system message will reach the customer, but our rider
  // will still need to be opted-in.
  let justAMoment = thisConversation.messages.create({
    body: "Great! Just a moment while we connect you…",
  });

  // Use Template #2 for the rider.
  let riderOptIn = thisConversation.messages.create({
    author: customer,
    body: "Your customer has agreed to chat over WhatsApp to get this delivery sorted. You're now connected. Say hello!",
  });

  // Remove all scoped webhooks; we only want this once.
  let webhooks = [];
  thisConversation.webhooks.each((hook) => webhooks.push(hook.remove()));

  // Critically important: wait for the messages to resolve.
  Promise.all([justAMoment, riderOptIn, ...webhooks]).finally(() =>
    callback(null)
  );
};
```

To power this, we'll add a [Conversation Scoped webhook](/docs/conversations/api/conversation-scoped-webhook-resource) that we can remove later.

Step 7: Set up a Conversation Scoped Webhook to field the reply.

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createConversationScopedWebhook() {
  const webhook = await client.conversations.v1
    .conversations("CHxxxx")
    .webhooks.create({
      "configuration.filters": ["onMessageAdded"],
      "configuration.method": "get",
      "configuration.url": "http://funny-dunkin-3838.twil.io/customer-optin",
      target: "webhook",
    });

  console.log(webhook.sid);
}

createConversationScopedWebhook();
```

```python
# Download the helper library from https://www.twilio.com/docs/python/install
import os
from twilio.rest import Client

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = os.environ["TWILIO_ACCOUNT_SID"]
auth_token = os.environ["TWILIO_AUTH_TOKEN"]
client = Client(account_sid, auth_token)

webhook = client.conversations.v1.conversations("CHxxxx").webhooks.create(
    target="webhook",
    configuration_url="http://funny-dunkin-3838.twil.io/customer-optin",
    configuration_method="get",
    configuration_filters=["onMessageAdded"],
)

print(webhook.sid)
```

```csharp
// Install the C# / .NET helper library from twilio.com/docs/csharp/install

using System;
using Twilio;
using Twilio.Rest.Conversations.V1.Conversation;
using System.Threading.Tasks;
using System.Collections.Generic;

class Program {
    public static async Task Main(string[] args) {
        // Find your Account SID and Auth Token at twilio.com/console
        // and set the environment variables. See http://twil.io/secure
        string accountSid = Environment.GetEnvironmentVariable("TWILIO_ACCOUNT_SID");
        string authToken = Environment.GetEnvironmentVariable("TWILIO_AUTH_TOKEN");

        TwilioClient.Init(accountSid, authToken);

        var webhook = await WebhookResource.CreateAsync(
            target: WebhookResource.TargetEnum.Webhook,
            configurationUrl: "http://funny-dunkin-3838.twil.io/customer-optin",
            configurationMethod: WebhookResource.MethodEnum.Get,
            configurationFilters: new List<string> { "onMessageAdded" },
            pathConversationSid: "CHxxxx");

        Console.WriteLine(webhook.Sid);
    }
}
```

```java
// Install the Java helper library from twilio.com/docs/java/install

import java.util.Arrays;
import com.twilio.Twilio;
import com.twilio.rest.conversations.v1.conversation.Webhook;

public class Example {
    // Find your Account SID and Auth Token at twilio.com/console
    // and set the environment variables. See http://twil.io/secure
    public static final String ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    public static final String AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");

    public static void main(String[] args) {
        Twilio.init(ACCOUNT_SID, AUTH_TOKEN);
        Webhook webhook = Webhook.creator("CHxxxx", Webhook.Target.WEBHOOK)
                              .setConfigurationUrl("http://funny-dunkin-3838.twil.io/customer-optin")
                              .setConfigurationMethod(Webhook.Method.GET)
                              .setConfigurationFilters(Arrays.asList("onMessageAdded"))
                              .create();

        System.out.println(webhook.getSid());
    }
}
```

```go
// Download the helper library from https://www.twilio.com/docs/go/install
package main

import (
	"fmt"
	"github.com/twilio/twilio-go"
	conversations "github.com/twilio/twilio-go/rest/conversations/v1"
	"os"
)

func main() {
	// Find your Account SID and Auth Token at twilio.com/console
	// and set the environment variables. See http://twil.io/secure
	// Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN exists in your environment
	client := twilio.NewRestClient()

	params := &conversations.CreateConversationScopedWebhookParams{}
	params.SetTarget("webhook")
	params.SetConfigurationUrl("http://funny-dunkin-3838.twil.io/customer-optin")
	params.SetConfigurationMethod("get")
	params.SetConfigurationFilters([]string{
		"onMessageAdded",
	})

	resp, err := client.ConversationsV1.CreateConversationScopedWebhook("CHxxxx",
		params)
	if err != nil {
		fmt.Println(err.Error())
		os.Exit(1)
	} else {
		if resp.Sid != nil {
			fmt.Println(*resp.Sid)
		} else {
			fmt.Println(resp.Sid)
		}
	}
}
```

```php
<?php

// Update the path below to your autoload.php,
// see https://getcomposer.org/doc/01-basic-usage.md
require_once "/path/to/vendor/autoload.php";

use Twilio\Rest\Client;

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
$sid = getenv("TWILIO_ACCOUNT_SID");
$token = getenv("TWILIO_AUTH_TOKEN");
$twilio = new Client($sid, $token);

$webhook = $twilio->conversations->v1
    ->conversations("CHxxxx")
    ->webhooks->create(
        "webhook", // Target
        [
            "configurationUrl" =>
                "http://funny-dunkin-3838.twil.io/customer-optin",
            "configurationMethod" => "get",
            "configurationFilters" => ["onMessageAdded"],
        ]
    );

print $webhook->sid;
```

```ruby
# Download the helper library from https://www.twilio.com/docs/ruby/install
require 'rubygems'
require 'twilio-ruby'

# Find your Account SID and Auth Token at twilio.com/console
# and set the environment variables. See http://twil.io/secure
account_sid = ENV['TWILIO_ACCOUNT_SID']
auth_token = ENV['TWILIO_AUTH_TOKEN']
@client = Twilio::REST::Client.new(account_sid, auth_token)

webhook = @client
          .conversations
          .v1
          .conversations('CHxxxx')
          .webhooks
          .create(
            target: 'webhook',
            configuration_url: 'http://funny-dunkin-3838.twil.io/customer-optin',
            configuration_method: 'get',
            configuration_filters: [
              'onMessageAdded'
            ]
          )

puts webhook.sid
```

```bash
# Install the twilio-cli from https://twil.io/cli

twilio api:conversations:v1:conversations:webhooks:create \
   --conversation-sid CHxxxx \
   --target webhook \
   --configuration.url http://funny-dunkin-3838.twil.io/customer-optin \
   --configuration.method get \
   --configuration.filters onMessageAdded
```

```bash
curl -X POST "https://conversations.twilio.com/v1/Conversations/CHxxxx/Webhooks" \
--data-urlencode "Target=webhook" \
--data-urlencode "Configuration.Url=http://funny-dunkin-3838.twil.io/customer-optin" \
--data-urlencode "Configuration.Method=get" \
--data-urlencode "Configuration.Filters=onMessageAdded" \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "conversation_sid": "CHxxxx",
  "sid": "WHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "target": "webhook",
  "configuration": {
    "url": "https://example.com",
    "method": "get",
    "filters": ["onMessageSent", "onConversationDestroyed"]
  },
  "date_created": "2016-03-24T21:05:50Z",
  "date_updated": "2016-03-24T21:05:50Z",
  "url": "https://conversations.twilio.com/v1/Conversations/CHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Webhooks/WHaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

Now let's start again by sending the initial opt-in message to test the whole flow.

![WhatsApp chat between customer and rider coordinating delivery location.](https://docs-resources.prod.twilio.com/0e56933ca85f83ccf14d9a3ce8ee78a0da80048dc80da4a1876eb63741b5faf7.png)

With all this setup, we've created the ideal experience for two-sided WhatsApp Conversations. Notice how system messaging manages expectations while we're still opting-in the second party. And after the initial setup, notice that we're not forwarding messages one-by-one among the parties: all of that happens automatically via Twilio Conversations platform. It only ends if/when you `DELETE` the conversation later on.

**Note:** Our templates fit neatly in [WhatsApp's guidelines](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates): they are not promotional, but rather they facilitate an active transaction. By following these patterns, your business could benefit from the same pattern.

## What's Next

Ready to learn more about Conversations and WhatsApp? Learn more with the following resources:

- [Send WhatsApp Notification Messages with Templates](/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates)
- [Register WhatsApp senders using Self Sign-up](/docs/whatsapp/self-sign-up)
- [WhatsApp Tech Provider Program](/docs/whatsapp/isv/tech-provider-program)
- [The Conversations API Reference](/docs/conversations/api)
- [The Conversations Scoped Webhook Resource](/docs/conversations/api/conversation-scoped-webhook-resource)
