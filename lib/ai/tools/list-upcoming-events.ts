import { tool } from "ai";
import { z } from "zod";
import eventsData from "@/events.json" with { type: "json" };

const venueSchema = z.object({
	name: z.string(),
	city: z.string(),
	state: z.string(),
});

const eventSchema = z.object({
	id: z.number(),
	title: z.string(),
	date: z.string(),
	time: z.string(),
	datetime: z.string(),
	venue: venueSchema,
	guests: z.number(),
	status: z.string(),
});

const eventsSchema = z.object({
	platform: z.string(),
	section: z.string(),
	description: z.string(),
	events: z.array(eventSchema),
});

type EventsPayload = z.infer<typeof eventsSchema>;

const events: EventsPayload = eventsSchema.parse(eventsData);

export const listUpcomingEvents = tool({
	description:
		"List all upcoming SVRN events with schedule, venue, and RSVP status.",
	inputSchema: z.object({}),
	execute: async (): Promise<EventsPayload> => events,
});
