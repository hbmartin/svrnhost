# Media subresource

Media is a subresource of [Messages](/docs/messaging/api/message-resource) and represents a piece of media, such as an image, that is associated with a Message.

Twilio creates a Media subresource and stores the contents of the media when the following events occur:

1. You [send an MMS](/docs/messaging/tutorials/how-to-send-sms-messages) with an image via Twilio.
2. You [send a WhatsApp message with an image](/docs/whatsapp/tutorial/send-and-receive-media-messages-twilio-api-whatsapp) via Twilio.
3. You receive media in a message sent to one of your Twilio numbers or messaging channel addresses.

Twilio retains the stored media until you [delete the related Media subresource instance.](#delete-media)

To secure access to media stored on Twilio, you can enable HTTP basic authentication in the Console [settings for Programmable Messaging](https://www.twilio.com/console/sms/settings).

> \[!WARNING]
>
> Messages sent via Twilio can include up to 10 media files that have a total size of up to 5MB. Twilio resizes images as necessary for successful delivery based on carrier specifications. Messages with over 5MB of media will **not** be accepted.

## Medium Properties

```json
{
  "type": "object",
  "refName": "api.v2010.account.message.media",
  "modelName": "api_v2010_account_message_media",
  "properties": {
    "account_sid": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^AC[0-9a-fA-F]{32}$",
      "nullable": true,
      "description": "The SID of the [Account](/docs/iam/api/account) associated with this Media resource."
    },
    "content_type": {
      "type": "string",
      "nullable": true,
      "description": "The default [MIME type](https://en.wikipedia.org/wiki/Internet_media_type) of the media, for example `image/jpeg`, `image/png`, or `image/gif`."
    },
    "date_created": {
      "type": "string",
      "format": "date-time-rfc-2822",
      "nullable": true,
      "description": "The date and time in GMT when this Media resource was created, specified in [RFC 2822](https://www.ietf.org/rfc/rfc2822.txt) format."
    },
    "date_updated": {
      "type": "string",
      "format": "date-time-rfc-2822",
      "nullable": true,
      "description": "The date and time in GMT when this Media resource was last updated, specified in [RFC 2822](https://www.ietf.org/rfc/rfc2822.txt) format."
    },
    "parent_sid": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^(SM|MM)[0-9a-fA-F]{32}$",
      "nullable": true,
      "description": "The SID of the Message resource that is associated with this Media resource."
    },
    "sid": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^ME[0-9a-fA-F]{32}$",
      "nullable": true,
      "description": "The unique string that identifies this Media resource."
    },
    "uri": {
      "type": "string",
      "nullable": true,
      "description": "The URI of this Media resource, relative to `https://api.twilio.com`."
    }
  }
}
```

## Retrieve Media

`GET https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Media/{Sid}.json`

Returns a single Media subresource using one of several representations:

- `content-type`
- `XML`
- `JSON`

### Default: content-type

Without an extension, the media is returned using the mime-type provided when the media was generated.

### Alternative: XML

Appending ".xml" to the URI returns a familiar XML representation. For example:

```xml
<TwilioResponse>
 <Media>
   <Sid>MEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</Sid>
   <AccountSid>ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</AccountSid>
   <ParentSid>MMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</ParentSid>
   <ContentType>image/jpeg</ContentType>
   <DateCreated>Fri, 17 Jul 2009 01:52:49 +0000</DateCreated>
   <DateUpdated>Fri, 17 Jul 2009 01:52:49 +0000</DateUpdated>
   <Uri>/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Message/MMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Media/MEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.xml</Uri>
 </Media>
</TwilioResponse>
```

### Alternative: JSON

Appending ".json" to the URI returns a familiar JSON representation. For example:

```javascript
{
    "sid": "MEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "account_sid": "ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "parent_sid": "MMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "content_type": "image/jpeg",
    "date_created": "Fri, 26 Apr 2013 05:41:35 +0000",
    "date_updated": "Fri, 26 Apr 2013 05:41:35 +0000",
    "uri": "/2010-04-01/Accounts/ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Message/MMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/Media/MEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.json"
}
```

### Path parameters

```json
[
  {
    "name": "AccountSid",
    "in": "path",
    "description": "The SID of the [Account](/docs/iam/api/account) associated with the Media resource.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^AC[0-9a-fA-F]{32}$"
    },
    "required": true
  },
  {
    "name": "MessageSid",
    "in": "path",
    "description": "The SID of the Message resource that is associated with the Media resource.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^(SM|MM)[0-9a-fA-F]{32}$"
    },
    "required": true
  },
  {
    "name": "Sid",
    "in": "path",
    "description": "The Twilio-provided string that uniquely identifies the Media resource to fetch.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^ME[0-9a-fA-F]{32}$"
    },
    "required": true
  }
]
```

> \[!NOTE]
>
> Because the stored media URLs are useful for many external applications, they are public and do not require HTTP Basic Auth to access. This allows you to embed the URL in a web application without revealing your Twilio API credentials.
>
> If you have a need to restrict access to media stored with Twilio, you can enable HTTP Auth in the Console settings. When you fetch your Message Media after enabling HTTP auth, you will be directed to a signed URL that is only valid for 4 hours.
>
> You can make subsequent API requests for new short-lived URLs for your media at any time.

Fetch a Medium

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function fetchMedia() {
  const media = await client
    .messages("SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .media("MEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .fetch();

  console.log(media.accountSid);
}

fetchMedia();
```

```json
{
  "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "content_type": "image/jpeg",
  "date_created": "Sun, 16 Aug 2015 15:53:54 +0000",
  "date_updated": "Sun, 16 Aug 2015 15:53:55 +0000",
  "parent_sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "sid": "MEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media/MEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
}
```

## Retrieve a list of Media

`GET https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Media.json`

Returns a list of Media associated with your Message. The list includes [paging information](/docs/usage/twilios-response#pagination).

Retrieve a list of Media associated with a Message

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function listMedia() {
  const media = await client
    .messages("MMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .media.list({ limit: 20 });

  media.forEach((m) => console.log(m.accountSid));
}

listMedia();
```

```json
{
  "end": 0,
  "first_page_uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json?DateCreated%3E=2008-01-02&PageSize=50&Page=0",
  "media_list": [
    {
      "account_sid": "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "content_type": "image/jpeg",
      "date_created": "Sun, 16 Aug 2015 15:53:54 +0000",
      "date_updated": "Sun, 16 Aug 2015 15:53:55 +0000",
      "parent_sid": "SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "sid": "MEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media/MEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json"
    }
  ],
  "next_page_uri": null,
  "page": 0,
  "page_size": 50,
  "previous_page_uri": null,
  "start": 0,
  "uri": "/2010-04-01/Accounts/ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Messages/SMaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/Media.json?DateCreated%3E=2008-01-02&PageSize=50&Page=0"
}
```

### Filter by date created

You may limit the list of Message Media to media created on a given date. Provide the following query string parameter to your API call:

### Path parameters

```json
[
  {
    "name": "AccountSid",
    "in": "path",
    "description": "The SID of the [Account](/docs/iam/api/account) that is associated with the Media resources.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^AC[0-9a-fA-F]{32}$"
    },
    "required": true
  },
  {
    "name": "MessageSid",
    "in": "path",
    "description": "The SID of the Message resource that is associated with the Media resources.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^(SM|MM)[0-9a-fA-F]{32}$"
    },
    "required": true
  }
]
```

### Query parameters

```json
[
  {
    "name": "DateCreated",
    "in": "query",
    "description": "Only include Media resources that were created on this date. Specify a date as `YYYY-MM-DD` in GMT, for example: `2009-07-06`, to read Media that were created on this date. You can also specify an inequality, such as `StartTime<=YYYY-MM-DD`, to read Media that were created on or before midnight of this date, and `StartTime>=YYYY-MM-DD` to read Media that were created on or after midnight of this date.",
    "schema": { "type": "string", "format": "date-time" }
  },
  {
    "name": "DateCreated<",
    "in": "query",
    "description": "Only include Media resources that were created on this date. Specify a date as `YYYY-MM-DD` in GMT, for example: `2009-07-06`, to read Media that were created on this date. You can also specify an inequality, such as `StartTime<=YYYY-MM-DD`, to read Media that were created on or before midnight of this date, and `StartTime>=YYYY-MM-DD` to read Media that were created on or after midnight of this date.",
    "schema": { "type": "string", "format": "date-time" },
    "examples": { "readEmptyDatecreatedLess": { "value": "2008-01-02" } }
  },
  {
    "name": "DateCreated>",
    "in": "query",
    "description": "Only include Media resources that were created on this date. Specify a date as `YYYY-MM-DD` in GMT, for example: `2009-07-06`, to read Media that were created on this date. You can also specify an inequality, such as `StartTime<=YYYY-MM-DD`, to read Media that were created on or before midnight of this date, and `StartTime>=YYYY-MM-DD` to read Media that were created on or after midnight of this date.",
    "schema": { "type": "string", "format": "date-time" },
    "examples": { "readFull": { "value": "2008-01-02" } }
  },
  {
    "name": "PageSize",
    "in": "query",
    "description": "How many resources to return in each list page. The default is 50, and the maximum is 1000.",
    "schema": {
      "type": "integer",
      "format": "int64",
      "minimum": 1,
      "maximum": 1000
    }
  },
  {
    "name": "Page",
    "in": "query",
    "description": "The page index. This value is simply for client state.",
    "schema": { "type": "integer", "minimum": 0 }
  },
  {
    "name": "PageToken",
    "in": "query",
    "description": "The page token. This is provided by the API.",
    "schema": { "type": "string" }
  }
]
```

## Delete Media

`DELETE https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages/{MessageSid}/Media/{Sid}.json`

Deletes Media from your account.

If successful, returns HTTP 204 (No Content) with no body.

### Path parameters

```json
[
  {
    "name": "AccountSid",
    "in": "path",
    "description": "The SID of the [Account](/docs/iam/api/account) that is associated with the Media resource.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^AC[0-9a-fA-F]{32}$"
    },
    "required": true
  },
  {
    "name": "MessageSid",
    "in": "path",
    "description": "The SID of the Message resource that is associated with the Media resource.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^(SM|MM)[0-9a-fA-F]{32}$"
    },
    "required": true
  },
  {
    "name": "Sid",
    "in": "path",
    "description": "The unique identifier of the to-be-deleted Media resource.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^ME[0-9a-fA-F]{32}$"
    },
    "required": true
  }
]
```

Delete Media from your account

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function deleteMedia() {
  await client
    .messages("MMXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .media("MEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
    .remove();
}

deleteMedia();
```

### Hints and Advanced Uses \[#hints]

- Twilio attempts to cache the media file the first time it is used. This may add a slight delay in sending the message.
- Twilio caches files when HTTP headers allow it (via ETag and Last-Modified headers). Responding with `Cache-Control: no-cache` ensures Twilio always checks if the file has changed, allowing your web server to respond with a new version or with a 304 Not Modified to instruct Twilio to use its cached version.
