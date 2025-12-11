# Senders API - WhatsApp

The Senders API allows you to create, retrieve, update, and delete WhatsApp senders programmatically. A WhatsApp sender represents a phone number registered with WhatsApp Business through Twilio.

## Base URL


## Senders properties

```json
{
  "type": "object",
  "refName": "messaging.v2.channels_sender_response",
  "modelName": "messaging_v2_channels_sender_response",
  "properties": {
    "sid": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^XE[0-9a-fA-F]{32}$",
      "nullable": true,
      "description": "The SID of the sender."
    },
    "status": {
      "type": "string",
      "enum": [
        "CREATING",
        "ONLINE",
        "OFFLINE",
        "PENDING_VERIFICATION",
        "VERIFYING",
        "ONLINE:UPDATING",
        "TWILIO_REVIEW",
        "DRAFT",
        "STUBBED"
      ],
      "description": "The status of the sender.\n",
      "refName": "channels_sender_enum_status",
      "modelName": "channels_sender_enum_status"
    },
    "sender_id": {
      "type": "string",
      "description": "The ID of the sender in `whatsapp:<E.164_PHONE_NUMBER>` format.",
      "example": "whatsapp:+15017122661",
      "nullable": true,
      "refName": "messaging.v2.channels_sender.fields.sender_id",
      "modelName": "messaging_v2_channels_sender_fields_sender_id"
    },
    "configuration": {
      "type": "object",
      "nullable": true,
      "description": "The configuration settings for creating a sender.",
      "refName": "messaging.v2.channels_sender.configuration",
      "modelName": "messaging_v2_channels_sender_configuration",
      "properties": {
        "waba_id": {
          "type": "string",
          "description": "The ID of the WhatsApp Business Account (WABA) to use for this sender.",
          "example": "12345678912345",
          "nullable": true
        },
        "verification_method": {
          "type": "string",
          "enum": ["sms", "voice"],
          "description": "The verification method.",
          "example": "sms",
          "default": "sms",
          "nullable": true
        },
        "verification_code": {
          "type": "string",
          "description": "The verification code.",
          "nullable": true
        },
        "voice_application_sid": {
          "type": "string",
          "description": "The SID of the Twilio Voice application.",
          "nullable": true
        }
      }
    },
    "webhook": {
      "type": "object",
      "nullable": true,
      "description": "The configuration settings for webhooks.",
      "refName": "messaging.v2.channels_sender.webhook",
      "modelName": "messaging_v2_channels_sender_webhook",
      "properties": {
        "callback_url": {
          "type": "string",
          "description": "The URL to send the webhook to.",
          "nullable": true
        },
        "callback_method": {
          "type": "string",
          "enum": ["POST", "PUT"],
          "description": "The HTTP method for the webhook.",
          "nullable": true
        },
        "fallback_url": {
          "type": "string",
          "description": "The URL to send the fallback webhook to.",
          "nullable": true
        },
        "fallback_method": {
          "type": "string",
          "enum": ["POST", "PUT"],
          "description": "The HTTP method for the fallback webhook.",
          "nullable": true
        },
        "status_callback_url": {
          "type": "string",
          "description": "The URL to send the status callback to.",
          "nullable": true
        },
        "status_callback_method": {
          "type": "string",
          "description": "The HTTP method for the status callback.",
          "nullable": true
        }
      }
    },
    "profile": {
      "type": "object",
      "nullable": true,
      "description": "The profile information for the sender.\n",
      "refName": "messaging.v2.channels_sender.profile_generic_response",
      "modelName": "messaging_v2_channels_sender_profile_generic_response",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name of the sender.",
          "nullable": true
        },
        "about": {
          "type": "string",
          "description": "The profile about text for the sender.",
          "nullable": true
        },
        "address": {
          "type": "string",
          "description": "The address of the sender.",
          "nullable": true
        },
        "description": {
          "type": "string",
          "description": "The description of the sender.",
          "nullable": true
        },
        "logo_url": {
          "type": "string",
          "description": "The logo URL of the sender.",
          "nullable": true
        },
        "banner_url": {
          "type": "string",
          "description": "The banner URL of the sender.",
          "nullable": true
        },
        "privacy_url": {
          "type": "string",
          "description": "The privacy URL of the sender. Must be a publicly accessible HTTP or HTTPS URI associated with the sender.",
          "nullable": true
        },
        "terms_of_service_url": {
          "type": "string",
          "description": "The terms of service URL of the sender.",
          "nullable": true
        },
        "accent_color": {
          "type": "string",
          "description": "The color theme of the sender. Must be in hex format and have at least a 4:5:1 contrast ratio against white.",
          "nullable": true
        },
        "vertical": {
          "type": "string",
          "description": "The vertical of the sender. Allowed values are:\n- `Automotive`\n- `Beauty, Spa and Salon`\n- `Clothing and Apparel`\n- `Education`\n- `Entertainment`\n- `Event Planning and Service`\n- `Finance and Banking`\n- `Food and Grocery`\n- `Public Service`\n- `Hotel and Lodging`\n- `Medical and Health`\n- `Non-profit`\n- `Professional Services`\n- `Shopping and Retail`\n- `Travel and Transportation`\n- `Restaurant`\n- `Other`\n",
          "nullable": true
        },
        "websites": {
          "description": "The websites of the sender.",
          "nullable": true,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "website": { "type": "string" },
              "label": { "type": "string" }
            }
          }
        },
        "emails": {
          "description": "The emails of the sender.",
          "nullable": true,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "email": { "type": "string" },
              "label": { "type": "string" }
            }
          }
        },
        "phone_numbers": {
          "description": "The phone numbers of the sender.",
          "nullable": true,
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "phone_number": { "type": "string" },
              "label": { "type": "string" }
            }
          }
        }
      }
    },
    "properties": {
      "type": "object",
      "nullable": true,
      "description": "The additional properties for the sender.",
      "refName": "messaging.v2.channels_sender.properties",
      "modelName": "messaging_v2_channels_sender_properties",
      "properties": {
        "quality_rating": {
          "type": "string",
          "description": "The quality rating of the sender.",
          "example": "HIGH",
          "nullable": true
        },
        "messaging_limit": {
          "type": "string",
          "description": "The messaging limit of the sender.",
          "example": "10K Customers/24hr",
          "nullable": true
        }
      }
    },
    "offline_reasons": {
      "type": "array",
      "nullable": true,
      "description": "The reasons why the sender is offline.",
      "refName": "messaging.v2.channels_sender.offline_reasons",
      "modelName": "messaging_v2_channels_sender_offline_reasons",
      "items": {
        "type": "object",
        "nullable": true,
        "refName": "messaging.v2.channels_sender.offline_reasons.items",
        "modelName": "messaging_v2_channels_sender_offline_reasons_items",
        "properties": {
          "code": {
            "type": "string",
            "description": "The error code.",
            "nullable": true
          },
          "message": {
            "type": "string",
            "description": "The error message.",
            "nullable": true
          },
          "more_info": {
            "type": "string",
            "format": "uri",
            "description": "The URL to get more information about the error.",
            "nullable": true
          }
        }
      }
    },
    "compliance": {
      "description": "The KYC compliance information. This section consists of response to the request launch.",
      "type": "object",
      "nullable": true,
      "required": ["registration_sid"],
      "refName": "messaging.v2.rcs_compliance_response",
      "modelName": "messaging_v2_rcs_compliance_response",
      "properties": {
        "registration_sid": {
          "type": "string",
          "description": "The default compliance registration SID (e.g., from CR-Google) that applies to all countries unless overridden in the `countries` array.\n"
        },
        "countries": {
          "type": "array",
          "description": "A list of country-specific compliance details.\n",
          "items": {
            "type": "object",
            "required": ["country"],
            "refName": "messaging.v2.rcs_compliance_country_response",
            "modelName": "messaging_v2_rcs_compliance_country_response",
            "properties": {
              "country": {
                "type": "string",
                "description": "The ISO 3166-1 alpha-2 country code.",
                "example": "US"
              },
              "registration_sid": {
                "type": "string",
                "description": "The default compliance registration SID (e.g., from CR-Google) that applies to all countries unless overridden in the `countries` array.\n"
              },
              "status": {
                "type": "string",
                "description": "The country-level status. Based on the aggregation of the carrier-level status.",
                "enum": [
                  "ONLINE",
                  "OFFLINE",
                  "TWILIO_REVIEW",
                  "PENDING_VERIFICATION"
                ],
                "refName": "messaging.v2.rcs_country_status",
                "modelName": "messaging_v2_rcs_country_status"
              },
              "carriers": {
                "type": "array",
                "items": {
                  "type": "object",
                  "refName": "messaging.v2.rcs_carrier",
                  "modelName": "messaging_v2_rcs_carrier",
                  "properties": {
                    "name": {
                      "type": "string",
                      "description": "The name of the carrier. For example, `Verizon` or `AT&T` for US."
                    },
                    "status": {
                      "type": "string",
                      "description": "The carrier-level status.",
                      "enum": [
                        "UNKNOWN",
                        "UNLAUNCHED",
                        "CARRIER_REVIEW",
                        "APPROVED",
                        "REJECTED",
                        "SUSPENDED"
                      ],
                      "refName": "messaging.v2.rcs_carrier_status",
                      "modelName": "messaging_v2_rcs_carrier_status"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "url": {
      "type": "string",
      "format": "uri",
      "nullable": true,
      "description": "The URL of the resource."
    }
  }
}
```

> \[!NOTE]
>
> For WhatsApp senders, the `Compliance` property is set to `null`.

## Create and register a Sender

`POST https://messaging.twilio.com/v2/Channels/Senders`

### Request body parameters

```json
{
  "schema": {
    "type": "object",
    "required": ["sender_id"],
    "refName": "messaging.v2.channels_sender.requests.create",
    "modelName": "messaging_v2_channels_sender_requests_create",
    "properties": {
      "sender_id": {
        "type": "string",
        "description": "The ID of the sender in `whatsapp:<E.164_PHONE_NUMBER>` format.",
        "example": "whatsapp:+15017122661",
        "nullable": true,
        "x-field-extra-annotation": "@com.fasterxml.jackson.annotation.JsonProperty(\"sender_id\")",
        "refName": "messaging.v2.channels_sender.fields.sender_id",
        "modelName": "messaging_v2_channels_sender_fields_sender_id"
      },
      "configuration": {
        "type": "object",
        "nullable": true,
        "description": "The configuration settings for creating a sender.",
        "refName": "messaging.v2.channels_sender.configuration",
        "modelName": "messaging_v2_channels_sender_configuration",
        "properties": {
          "waba_id": {
            "type": "string",
            "description": "The ID of the WhatsApp Business Account (WABA) to use for this sender.",
            "example": "12345678912345",
            "nullable": true
          },
          "verification_method": {
            "type": "string",
            "enum": ["sms", "voice"],
            "description": "The verification method.",
            "example": "sms",
            "default": "sms",
            "nullable": true
          },
          "verification_code": {
            "type": "string",
            "description": "The verification code.",
            "nullable": true
          },
          "voice_application_sid": {
            "type": "string",
            "description": "The SID of the Twilio Voice application.",
            "nullable": true
          }
        }
      },
      "webhook": {
        "type": "object",
        "nullable": true,
        "description": "The configuration settings for webhooks.",
        "refName": "messaging.v2.channels_sender.webhook",
        "modelName": "messaging_v2_channels_sender_webhook",
        "properties": {
          "callback_url": {
            "type": "string",
            "description": "The URL to send the webhook to.",
            "nullable": true
          },
          "callback_method": {
            "type": "string",
            "enum": ["POST", "PUT"],
            "description": "The HTTP method for the webhook.",
            "nullable": true
          },
          "fallback_url": {
            "type": "string",
            "description": "The URL to send the fallback webhook to.",
            "nullable": true
          },
          "fallback_method": {
            "type": "string",
            "enum": ["POST", "PUT"],
            "description": "The HTTP method for the fallback webhook.",
            "nullable": true
          },
          "status_callback_url": {
            "type": "string",
            "description": "The URL to send the status callback to.",
            "nullable": true
          },
          "status_callback_method": {
            "type": "string",
            "description": "The HTTP method for the status callback.",
            "nullable": true
          }
        }
      },
      "profile": {
        "type": "object",
        "nullable": true,
        "description": "The profile information for the sender.\n",
        "refName": "messaging.v2.channels_sender.profile",
        "modelName": "messaging_v2_channels_sender_profile",
        "properties": {
          "name": {
            "type": "string",
            "description": "The name of the sender. Required for WhatsApp senders and must follow [Meta's display name guidelines](https://www.facebook.com/business/help/757569725593362).",
            "nullable": true
          },
          "about": {
            "type": "string",
            "description": "The profile about text for the sender.",
            "nullable": true
          },
          "address": {
            "type": "string",
            "description": "The address of the sender.",
            "nullable": true
          },
          "description": {
            "type": "string",
            "description": "The description of the sender.",
            "nullable": true
          },
          "logo_url": {
            "type": "string",
            "description": "The logo URL of the sender.",
            "nullable": true
          },
          "banner_url": {
            "type": "string",
            "description": "The banner URL of the sender.",
            "nullable": true
          },
          "privacy_url": {
            "type": "string",
            "description": "The privacy URL of the sender. Must be a publicly accessible HTTP or HTTPS URI associated with the sender.\n",
            "nullable": true
          },
          "terms_of_service_url": {
            "type": "string",
            "description": "The terms of service URL of the sender.",
            "nullable": true
          },
          "accent_color": {
            "type": "string",
            "description": "The color theme of the sender. Must be in hex format and have at least a 4:5:1 contrast ratio against white.",
            "nullable": true
          },
          "vertical": {
            "type": "string",
            "description": "The vertical of the sender. Allowed values are:\n- `Automotive`\n- `Beauty, Spa and Salon`\n- `Clothing and Apparel`\n- `Education`\n- `Entertainment`\n- `Event Planning and Service`\n- `Finance and Banking`\n- `Food and Grocery`\n- `Public Service`\n- `Hotel and Lodging`\n- `Medical and Health`\n- `Non-profit`\n- `Professional Services`\n- `Shopping and Retail`\n- `Travel and Transportation`\n- `Restaurant`\n- `Other`\n",
            "nullable": true
          },
          "websites": { "description": "The websites of the sender." },
          "emails": { "description": "The emails of the sender." },
          "phone_numbers": { "description": "The phone numbers of the sender." }
        }
      }
    }
  },
  "examples": {
    "whatsapp_create": {
      "value": {
        "lang": "json",
        "value": "{\n  \"sender_id\": \"whatsapp:+999999999XX\",\n  \"configuration\": {\n    \"waba_id\": \"1234567XXX\",\n    \"verification_method\": \"sms\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Profile Name\",\n    \"about\": \"This is an example about text.\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"This is an example description.\",\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"Email\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"Email\"\n      }\n    ],\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ]\n  }\n}",
        "meta": "",
        "code": "{\n  \"sender_id\": \"whatsapp:+999999999XX\",\n  \"configuration\": {\n    \"waba_id\": \"1234567XXX\",\n    \"verification_method\": \"sms\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Profile Name\",\n    \"about\": \"This is an example about text.\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"This is an example description.\",\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"Email\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"Email\"\n      }\n    ],\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ]\n  }\n}",
        "tokens": [
          ["{", "#C9D1D9"],
          "\n  ",
          ["\"sender_id\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"whatsapp:+999999999XX\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n  ",
          ["\"configuration\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"waba_id\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"1234567XXX\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"verification_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"sms\"", "#A5D6FF"],
          "\n  ",
          ["},", "#C9D1D9"],
          "\n  ",
          ["\"webhook\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"callback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://callback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"callback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"fallback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://fallback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"fallback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"status_callback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://statuscallback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"status_callback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          "\n  ",
          ["},", "#C9D1D9"],
          "\n  ",
          ["\"profile\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"name\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Example Profile Name\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"about\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"This is an example about text.\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"address\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"123 Example St, Example City, EX 12345\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"description\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"This is an example description.\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"emails\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"email\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"example1@example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Email\"", "#A5D6FF"],
          "\n      ",
          ["},", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"email\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"example2@example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Email\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["],", "#C9D1D9"],
          "\n    ",
          ["\"logo_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://logo_url.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"vertical\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Automotive\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"websites\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"website\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://website1.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Website1\"", "#A5D6FF"],
          "\n      ",
          ["},", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"website\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"http://website2.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Website2\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["]", "#C9D1D9"],
          "\n  ",
          ["}", "#C9D1D9"],
          "\n",
          ["}", "#C9D1D9"]
        ],
        "annotations": [],
        "themeName": "github-dark",
        "style": { "color": "#c9d1d9", "background": "#0d1117" }
      },
      "refName": "#/components/examples/whatsapp_create_request",
      "modelName": "__components_examples_whatsapp_create_request"
    },
    "rcs_create": {
      "value": {
        "lang": "json",
        "value": "{\n  \"sender_id\": \"rcs:twilio_agent\",\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"RCS Profile Name\",\n    \"description\": \"RCS description.\",\n    \"accent_color\": \"#ffffff\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"banner_url\": \"https://banner_url.example.com\",\n    \"privacy_url\": \"https://privacy_url.example.com\",\n    \"terms_of_service_url\": \"https://terms_of_service_url.example.com\",\n    \"phone_numbers\": [\n      {\n        \"phone_number\": \"+12125551212\",\n        \"label\": \"phone\"\n      }\n    ],\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"example1\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"example2\"\n      }\n    ]\n  }\n}",
        "meta": "",
        "code": "{\n  \"sender_id\": \"rcs:twilio_agent\",\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"RCS Profile Name\",\n    \"description\": \"RCS description.\",\n    \"accent_color\": \"#ffffff\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"banner_url\": \"https://banner_url.example.com\",\n    \"privacy_url\": \"https://privacy_url.example.com\",\n    \"terms_of_service_url\": \"https://terms_of_service_url.example.com\",\n    \"phone_numbers\": [\n      {\n        \"phone_number\": \"+12125551212\",\n        \"label\": \"phone\"\n      }\n    ],\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website1\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website2\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"example1@example.com\",\n        \"label\": \"example1\"\n      },\n      {\n        \"email\": \"example2@example.com\",\n        \"label\": \"example2\"\n      }\n    ]\n  }\n}",
        "tokens": [
          ["{", "#C9D1D9"],
          "\n  ",
          ["\"sender_id\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"rcs:twilio_agent\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n  ",
          ["\"webhook\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"callback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://callback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"callback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"fallback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://fallback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"fallback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"status_callback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://statuscallback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"status_callback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          "\n  ",
          ["},", "#C9D1D9"],
          "\n  ",
          ["\"profile\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"name\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"RCS Profile Name\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"description\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"RCS description.\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"accent_color\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"#ffffff\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"logo_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://logo_url.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"banner_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://banner_url.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"privacy_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://privacy_url.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"terms_of_service_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://terms_of_service_url.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"phone_numbers\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"phone_number\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"+12125551212\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"phone\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["],", "#C9D1D9"],
          "\n    ",
          ["\"websites\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"website\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://website1.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Website1\"", "#A5D6FF"],
          "\n      ",
          ["},", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"website\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"http://website2.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Website2\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["],", "#C9D1D9"],
          "\n    ",
          ["\"emails\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"email\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"example1@example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"example1\"", "#A5D6FF"],
          "\n      ",
          ["},", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"email\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"example2@example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"example2\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["]", "#C9D1D9"],
          "\n  ",
          ["}", "#C9D1D9"],
          "\n",
          ["}", "#C9D1D9"]
        ],
        "annotations": [],
        "themeName": "github-dark",
        "style": { "color": "#c9d1d9", "background": "#0d1117" }
      },
      "refName": "#/components/examples/rcs_create_request",
      "modelName": "__components_examples_rcs_create_request"
    }
  },
  "encodingType": "application/json",
  "conditionalParameterMap": {}
}
```

WhatsApp:Create and register a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function createChannelsSender() {
  const channelsSender = await client.messaging.v2.channelsSenders.create({
    sender_id: "whatsapp:+15551234",
  });

  console.log(channelsSender.sid);
}

createChannelsSender();
```


```json
{
  "sid": "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "CREATING",
  "sender_id": "whatsapp:+15551234",
  "configuration": {
    "waba_id": "1234567XXX",
    "verification_method": "sms",
    "verification_code": null,
    "voice_application_sid": "APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  },
  "webhook": {
    "callback_url": "https://callback.example.com",
    "callback_method": "POST",
    "fallback_url": "https://fallback.example.com",
    "fallback_method": "POST",
    "status_callback_url": "https://statuscallback.example.com",
    "status_callback_method": "POST"
  },
  "profile": {
    "name": "Example Profile Name",
    "about": "This is an example about text.",
    "address": "123 Example St, Example City, EX 12345",
    "description": "This is an example description.",
    "emails": [
      {
        "email": "example@example.com",
        "label": "Email"
      },
      {
        "email": "example2@example.com",
        "label": "Email"
      }
    ],
    "logo_url": "https://logo_url.example.com",
    "vertical": "Automotive",
    "websites": [
      {
        "website": "https://website1.example.com",
        "label": "Website1"
      },
      {
        "website": "http://website2.example.com",
        "label": "Website2"
      }
    ]
  }
}
```

### Monitoring errors during Sender creation

The `POST /v2/Channels/Senders` request creates and registers a WhatsApp sender asynchronously. If the request successfully creates a sender but fails to complete the registration, you can find more information in the [Error Log](https://console.twilio.com/us1/monitor/logs/debugger/errors) in the Twilio Console.

An error log includes the following details:

- Error description
- Recommended actions to resolve it
- Resource SID, which matches the Sender SID in your initial request

To monitor error logs, use [Alarms](/docs/usage/troubleshooting/alarms) or [Event Streams](/docs/events).

#### Alarms

Set up an [alarm](/docs/usage/troubleshooting/alarms#configure-an-alarm) to receive instant notifications by email, Twilio Console, or webhook when error thresholds are met within a specific timeframe.

For example, you can set alarms for the following common errors:

- [63104](/docs/api/errors/63104): Maximum number of phone numbers reached for your WhatsApp Business Account (WABA)
- [63110](/docs/api/errors/63110): The phone number is already registered on WhatsApp
- [63111](/docs/api/errors/63111): Sender's phone number or WABA returned "not found"
- [63100](/docs/api/errors/63100): Validation Error
- [63113](/docs/api/errors/63113): Sender Cannot Be Verified
- [63114](/docs/api/errors/63114): Too Many Verification Codes
- [63116](/docs/api/errors/63116): WhatsApp Sender failed to be automatically registered as OTP was not received

#### Event Streams

Set up an Event Stream to subscribe to [Error Log events](/docs/events/event-types/errors/error-logs) to receive notifications for every logged error. Each event payload includes the error code and a `correlation_sid`, which matches the Sender SID in the response of your initial request. This helps you track and resolve errors.

## Retrieve a Sender

`GET https://messaging.twilio.com/v2/Channels/Senders/{Sid}`

### Path parameters

```json
[
  {
    "name": "Sid",
    "required": true,
    "in": "path",
    "description": "The SID of the sender.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^XE[0-9a-fA-F]{32}$"
    }
  }
]
```

WhatsApp: Retrieve a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function fetchChannelsSender() {
  const channelsSender = await client.messaging.v2
    .channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .fetch();

  console.log(channelsSender.sid);
}

fetchChannelsSender();
```


```json
{
  "sid": "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "ONLINE",
  "sender_id": "whatsapp:+999999999XX",
  "configuration": {
    "waba_id": "1234567XXX",
    "verification_method": null,
    "verification_code": null,
    "voice_application_sid": "APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  },
  "webhook": {
    "callback_url": "https://callback.example.com",
    "callback_method": "POST",
    "fallback_url": "https://fallback.example.com",
    "fallback_method": "POST",
    "status_callback_url": "https://statuscallback.example.com",
    "status_callback_method": "POST"
  },
  "profile": {
    "name": "Example Profile Name",
    "about": "This is an example about text.",
    "address": "123 Example St, Example City, EX 12345",
    "description": "This is an example description.",
    "emails": [
      {
        "email": "email@email.com",
        "label": "Email"
      }
    ],
    "logo_url": "https://logo_url.example.com",
    "vertical": "Automotive",
    "websites": [
      {
        "website": "https://website1.example.com",
        "label": "Website"
      },
      {
        "website": "http://website2.example.com",
        "label": "Website"
      }
    ],
    "banner_url": null,
    "privacy_url": null,
    "terms_of_service_url": null,
    "accent_color": null,
    "phone_numbers": null
  },
  "compliance": null,
  "properties": {
    "quality_rating": "HIGH",
    "messaging_limit": "10K Customers/24hr"
  },
  "offline_reasons": null,
  "url": "https://messaging.twilio.com/v2/Channels/Senders/XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
}
```

## Retrieve a list of Senders

`GET https://messaging.twilio.com/v2/Channels/Senders`

### Query parameters

```json
[
  {
    "name": "Channel",
    "required": true,
    "in": "query",
    "schema": {
      "type": "string",
      "description": "The messaging channel for senders. Supported values are `whatsapp` and `rcs`."
    }
  },
  {
    "name": "PageSize",
    "in": "query",
    "description": "The number of items to return per page. For WhatsApp, the default is `20`.",
    "schema": {
      "type": "integer",
      "format": "int64",
      "default": 50,
      "minimum": 1,
      "maximum": 1000
    }
  },
  {
    "name": "Page",
    "in": "query",
    "description": "The page index. Use only for client state.",
    "schema": { "type": "integer", "minimum": 0 }
  },
  {
    "name": "PageToken",
    "in": "query",
    "description": "The page token provided by the API.",
    "schema": { "type": "string" }
  }
]
```

WhatsApp: Retrieve a list of Senders

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function listChannelsSender() {
  const channelsSenders = await client.messaging.v2.channelsSenders.list({
    channel: "whatsapp",
    limit: 20,
  });

  channelsSenders.forEach((c) => console.log(c.sid));
}

listChannelsSender();
```


```json
{
  "senders": [],
  "meta": {
    "page": 0,
    "page_size": 10,
    "first_page_url": "https://messaging.twilio.com/v2/Channels/Senders?PageSize=10&Page=0&Channel=whatsapp",
    "previous_page_url": null,
    "url": "https://messaging.twilio.com/v2/Channels/Senders?PageSize=10&Page=0&Channel=whatsapp",
    "next_page_url": null,
    "key": "senders"
  }
}
```

## Update a Sender

`POST https://messaging.twilio.com/v2/Channels/Senders/{Sid}`

### Path parameters

```json
[
  {
    "name": "Sid",
    "required": true,
    "in": "path",
    "description": "The SID of the sender.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^XE[0-9a-fA-F]{32}$"
    }
  }
]
```

### Request body parameters

```json
{
  "schema": {
    "type": "object",
    "refName": "messaging.v2.channels_sender.requests.update",
    "modelName": "messaging_v2_channels_sender_requests_update",
    "properties": {
      "configuration": {
        "type": "object",
        "nullable": true,
        "description": "The configuration settings for creating a sender.",
        "refName": "messaging.v2.channels_sender.configuration",
        "modelName": "messaging_v2_channels_sender_configuration",
        "properties": {
          "waba_id": {
            "type": "string",
            "description": "The ID of the WhatsApp Business Account (WABA) to use for this sender.",
            "example": "12345678912345",
            "nullable": true
          },
          "verification_method": {
            "type": "string",
            "enum": ["sms", "voice"],
            "description": "The verification method.",
            "example": "sms",
            "default": "sms",
            "nullable": true
          },
          "verification_code": {
            "type": "string",
            "description": "The verification code.",
            "nullable": true
          },
          "voice_application_sid": {
            "type": "string",
            "description": "The SID of the Twilio Voice application.",
            "nullable": true
          }
        }
      },
      "webhook": {
        "type": "object",
        "nullable": true,
        "description": "The configuration settings for webhooks.",
        "refName": "messaging.v2.channels_sender.webhook",
        "modelName": "messaging_v2_channels_sender_webhook",
        "properties": {
          "callback_url": {
            "type": "string",
            "description": "The URL to send the webhook to.",
            "nullable": true
          },
          "callback_method": {
            "type": "string",
            "enum": ["POST", "PUT"],
            "description": "The HTTP method for the webhook.",
            "nullable": true
          },
          "fallback_url": {
            "type": "string",
            "description": "The URL to send the fallback webhook to.",
            "nullable": true
          },
          "fallback_method": {
            "type": "string",
            "enum": ["POST", "PUT"],
            "description": "The HTTP method for the fallback webhook.",
            "nullable": true
          },
          "status_callback_url": {
            "type": "string",
            "description": "The URL to send the status callback to.",
            "nullable": true
          },
          "status_callback_method": {
            "type": "string",
            "description": "The HTTP method for the status callback.",
            "nullable": true
          }
        }
      },
      "profile": {
        "type": "object",
        "nullable": true,
        "description": "The profile information for the sender.\n",
        "refName": "messaging.v2.channels_sender.profile",
        "modelName": "messaging_v2_channels_sender_profile",
        "properties": {
          "name": {
            "type": "string",
            "description": "The name of the sender. Required for WhatsApp senders and must follow [Meta's display name guidelines](https://www.facebook.com/business/help/757569725593362).",
            "nullable": true
          },
          "about": {
            "type": "string",
            "description": "The profile about text for the sender.",
            "nullable": true
          },
          "address": {
            "type": "string",
            "description": "The address of the sender.",
            "nullable": true
          },
          "description": {
            "type": "string",
            "description": "The description of the sender.",
            "nullable": true
          },
          "logo_url": {
            "type": "string",
            "description": "The logo URL of the sender.",
            "nullable": true
          },
          "banner_url": {
            "type": "string",
            "description": "The banner URL of the sender.",
            "nullable": true
          },
          "privacy_url": {
            "type": "string",
            "description": "The privacy URL of the sender. Must be a publicly accessible HTTP or HTTPS URI associated with the sender.\n",
            "nullable": true
          },
          "terms_of_service_url": {
            "type": "string",
            "description": "The terms of service URL of the sender.",
            "nullable": true
          },
          "accent_color": {
            "type": "string",
            "description": "The color theme of the sender. Must be in hex format and have at least a 4:5:1 contrast ratio against white.",
            "nullable": true
          },
          "vertical": {
            "type": "string",
            "description": "The vertical of the sender. Allowed values are:\n- `Automotive`\n- `Beauty, Spa and Salon`\n- `Clothing and Apparel`\n- `Education`\n- `Entertainment`\n- `Event Planning and Service`\n- `Finance and Banking`\n- `Food and Grocery`\n- `Public Service`\n- `Hotel and Lodging`\n- `Medical and Health`\n- `Non-profit`\n- `Professional Services`\n- `Shopping and Retail`\n- `Travel and Transportation`\n- `Restaurant`\n- `Other`\n",
            "nullable": true
          },
          "websites": { "description": "The websites of the sender." },
          "emails": { "description": "The emails of the sender." },
          "phone_numbers": { "description": "The phone numbers of the sender." }
        }
      }
    }
  },
  "examples": {
    "update": {
      "value": {
        "lang": "json",
        "value": "{\n  \"configuration\": {\n    \"verification_code\": \"123456\",\n    \"voice_application_sid\": \"APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Business\",\n    \"about\": \"Example about text\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"Example description\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"email@email.com\",\n        \"label\": \"Email\"\n      }\n    ]\n  }\n}",
        "meta": "",
        "code": "{\n  \"configuration\": {\n    \"verification_code\": \"123456\",\n    \"voice_application_sid\": \"APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"\n  },\n  \"webhook\": {\n    \"callback_url\": \"https://callback.example.com\",\n    \"callback_method\": \"POST\",\n    \"fallback_url\": \"https://fallback.example.com\",\n    \"fallback_method\": \"POST\",\n    \"status_callback_url\": \"https://statuscallback.example.com\",\n    \"status_callback_method\": \"POST\"\n  },\n  \"profile\": {\n    \"name\": \"Example Business\",\n    \"about\": \"Example about text\",\n    \"address\": \"123 Example St, Example City, EX 12345\",\n    \"description\": \"Example description\",\n    \"logo_url\": \"https://logo_url.example.com\",\n    \"vertical\": \"Automotive\",\n    \"websites\": [\n      {\n        \"website\": \"https://website1.example.com\",\n        \"label\": \"Website\"\n      },\n      {\n        \"website\": \"http://website2.example.com\",\n        \"label\": \"Website\"\n      }\n    ],\n    \"emails\": [\n      {\n        \"email\": \"email@email.com\",\n        \"label\": \"Email\"\n      }\n    ]\n  }\n}",
        "tokens": [
          ["{", "#C9D1D9"],
          "\n  ",
          ["\"configuration\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"verification_code\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"123456\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"voice_application_sid\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"", "#A5D6FF"],
          "\n  ",
          ["},", "#C9D1D9"],
          "\n  ",
          ["\"webhook\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"callback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://callback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"callback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"fallback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://fallback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"fallback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"status_callback_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://statuscallback.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"status_callback_method\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"POST\"", "#A5D6FF"],
          "\n  ",
          ["},", "#C9D1D9"],
          "\n  ",
          ["\"profile\"", "#7EE787"],
          [": {", "#C9D1D9"],
          "\n    ",
          ["\"name\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Example Business\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"about\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Example about text\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"address\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"123 Example St, Example City, EX 12345\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"description\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Example description\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"logo_url\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://logo_url.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"vertical\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Automotive\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n    ",
          ["\"websites\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"website\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"https://website1.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Website\"", "#A5D6FF"],
          "\n      ",
          ["},", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"website\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"http://website2.example.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Website\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["],", "#C9D1D9"],
          "\n    ",
          ["\"emails\"", "#7EE787"],
          [": [", "#C9D1D9"],
          "\n      ",
          ["{", "#C9D1D9"],
          "\n        ",
          ["\"email\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"email@email.com\"", "#A5D6FF"],
          [",", "#C9D1D9"],
          "\n        ",
          ["\"label\"", "#7EE787"],
          [":", "#C9D1D9"],
          " ",
          ["\"Email\"", "#A5D6FF"],
          "\n      ",
          ["}", "#C9D1D9"],
          "\n    ",
          ["]", "#C9D1D9"],
          "\n  ",
          ["}", "#C9D1D9"],
          "\n",
          ["}", "#C9D1D9"]
        ],
        "annotations": [],
        "themeName": "github-dark",
        "style": { "color": "#c9d1d9", "background": "#0d1117" }
      }
    }
  },
  "encodingType": "application/json",
  "conditionalParameterMap": {}
}
```

To update a WhatsApp sender's information, make a `POST` request to the Sender resource. To verify a WhatsApp sender, include the `verification_code` parameter in your request.

WhatsApp: Update a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function updateChannelsSender() {
  const channelsSender = await client.messaging.v2
    .channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .update({
      configuration: {
        waba_id: "waba_id",
        verification_method: "sms",
        verification_code: "verification_code",
        voice_application_sid: "voice_application_sid",
      },
    });

  console.log(channelsSender.sid);
}

updateChannelsSender();
```


```json
{
  "sid": "XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "status": "VERIFYING",
  "sender_id": "whatsapp:+999999999XX",
  "compliance": null,
  "configuration": {
    "waba_id": "1234567XXX",
    "verification_method": "sms",
    "verification_code": null,
    "voice_application_sid": "APaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  "webhook": {
    "callback_url": "https://callback.example.com",
    "callback_method": "POST",
    "fallback_url": "https://fallback.example.com",
    "fallback_method": "POST",
    "status_callback_url": "https://statuscallback.example.com",
    "status_callback_method": "POST"
  },
  "profile": {
    "about": "Example about text",
    "address": "123 Example St, Example City, EX 12345",
    "description": "Example description",
    "emails": [
      {
        "email": "email@email.com",
        "label": "Email"
      }
    ],
    "name": "Example Business",
    "logo_url": "https://logo_url.example.com",
    "vertical": "Automotive",
    "websites": [
      {
        "website": "https://website1.example.com",
        "label": "Website"
      },
      {
        "website": "http://website2.example.com",
        "label": "Website"
      }
    ],
    "banner_url": null,
    "privacy_url": null,
    "terms_of_service_url": null,
    "accent_color": null,
    "phone_numbers": null
  }
}
```

## Delete a Sender

`DELETE https://messaging.twilio.com/v2/Channels/Senders/{Sid}`

### Path parameters

```json
[
  {
    "name": "Sid",
    "required": true,
    "in": "path",
    "description": "The SID of the sender.",
    "schema": {
      "type": "string",
      "minLength": 34,
      "maxLength": 34,
      "pattern": "^XE[0-9a-fA-F]{32}$"
    }
  }
]
```

> \[!NOTE]
>
> If you want to re-register the same number after deleting a sender, you must turn off Two-Factor Authentication (2FA) for the number in the [WhatsApp Manager](https://business.facebook.com/latest/whatsapp_manager/).

WhatsApp: Delete a Sender

```js
// Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function deleteChannelsSender() {
  await client.messaging.v2
    .channelsSenders("XEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .remove();
}

deleteChannelsSender();
```


