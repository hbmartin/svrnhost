import { tool } from "ai";
import { z } from "zod";

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
	datetime: z.iso.datetime({ local: true, offset: true }),
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

const events: EventsPayload = eventsSchema.parse({
	platform: "Sovereign Community",
	section: "Experiences",
	description:
		"Exclusive dinners and events curated for the sovereign community",
	events: [
		{
			id: 1,
			title: "Founders Dinner: Building in Public",
			date: "2025-12-04",
			time: "19:12",
			datetime: "2025-12-04T19:12:00",
			venue: {
				name: "The Modern Restaurant",
				city: "San Francisco",
				state: "CA",
			},
			guests: 8,
			status: "rsvp_available",
		},
		{
			id: 2,
			title: "Web3 Summit: The Future of Decentralization",
			date: "2025-12-09",
			time: "14:00",
			datetime: "2025-12-09T14:00:00",
			venue: {
				name: "Crypto Convention Center",
				city: "Miami",
				state: "FL",
			},
			guests: 150,
			status: "rsvp_available",
		},
		{
			id: 3,
			title: "Creative Minds Dinner",
			date: "2025-12-11",
			time: "20:13",
			datetime: "2025-12-11T20:13:00",
			venue: {
				name: "Atelier Fine Dining",
				city: "New York",
				state: "NY",
			},
			guests: 10,
			status: "rsvp_available",
		},
		{
			id: 4,
			title: "Wellness & Mindfulness Workshop",
			date: "2025-12-14",
			time: "10:00",
			datetime: "2025-12-14T10:00:00",
			venue: {
				name: "Zen Retreat Space",
				city: "San Francisco",
				state: "CA",
			},
			guests: 50,
			status: "rsvp_available",
		},
		{
			id: 5,
			title: "Investor Roundtable Dinner",
			date: "2025-12-17",
			time: "19:13",
			datetime: "2025-12-17T19:13:00",
			venue: {
				name: "The Capital Club",
				city: "San Francisco",
				state: "CA",
			},
			guests: 12,
			status: "rsvp_available",
		},
		{
			id: 6,
			title: "Art & Technology Exhibition",
			date: "2025-12-21",
			time: "18:00",
			datetime: "2025-12-21T18:00:00",
			venue: {
				name: "Digital Arts Gallery",
				city: "Brooklyn",
				state: "NY",
			},
			guests: 200,
			status: "rsvp_available",
		},
		{
			id: 7,
			title: "Tech Leaders Dinner",
			date: "2025-12-27",
			time: "20:13",
			datetime: "2025-12-27T20:13:00",
			venue: {
				name: "Silicon Bistro",
				city: "Palo Alto",
				state: "CA",
			},
			guests: 10,
			status: "rsvp_available",
		},
		{
			id: 8,
			title: "Startup Pitch Night",
			date: "2026-01-04",
			time: "17:30",
			datetime: "2026-01-04T17:30:00",
			venue: {
				name: "Venture Hall",
				city: "San Francisco",
				state: "CA",
			},
			guests: 100,
			status: "rsvp_available",
		},
		{
			id: 9,
			title: "Women in Business Dinner",
			date: "2026-01-07",
			time: "19:13",
			datetime: "2026-01-07T19:13:00",
			venue: {
				name: "Grace & Vine",
				city: "Los Angeles",
				state: "CA",
			},
			guests: 8,
			status: "rsvp_available",
		},
		{
			id: 10,
			title: "Design Thinking Workshop",
			date: "2026-01-11",
			time: "09:00",
			datetime: "2026-01-11T09:00:00",
			venue: {
				name: "Innovation Lab",
				city: "Seattle",
				state: "WA",
			},
			guests: 40,
			status: "rsvp_available",
		},
		{
			id: 11,
			title: "Product Innovators Dinner",
			date: "2026-01-14",
			time: "19:00",
			datetime: "2026-01-14T19:00:00",
			venue: {
				name: "Innovation Kitchen",
				city: "Austin",
				state: "TX",
			},
			guests: 10,
			status: "rsvp_available",
		},
		{
			id: 12,
			title: "Founder Fireside Chat Series",
			date: "2026-01-19",
			time: "19:00",
			datetime: "2026-01-19T19:00:00",
			venue: {
				name: "Startup Commons",
				city: "Austin",
				state: "TX",
			},
			guests: 80,
			status: "rsvp_available",
		},
	],
});

export const listUpcomingEvents = tool({
	description:
		"List all upcoming SVRN events with schedule, venue, and RSVP status.",
	inputSchema: z.object({}),
	execute: async (input): Promise<EventsPayload> => events,
});
