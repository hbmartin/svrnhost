import { tool } from "ai";
import { z } from "zod";

async function geocodeCity(
	city: string,
): Promise<{ latitude: number; longitude: number } | null> {
	try {
		const response = await fetch(
			`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
		);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		if (!data.results || data.results.length === 0) {
			return null;
		}

		const result = data.results[0];
		return {
			latitude: result.latitude,
			longitude: result.longitude,
		};
	} catch {
		return null;
	}
}

export const getWeather = tool({
	description:
		"Get the current weather at a location. You can provide either coordinates or a city name.",
	inputSchema: z.object({
		latitude: z.number().optional(),
		longitude: z.number().optional(),
		city: z
			.string()
			.describe("City name (e.g., 'San Francisco', 'New York', 'London')")
			.optional(),
	}),
	strict: true,
	inputExamples: [
		{ input: { city: "San Francisco" } },
		{ input: { city: "New York" } },
		{ input: { latitude: 51.5074, longitude: -0.1278 } },
	],
	execute: async (input) => {
		let latitude: number;
		let longitude: number;
		let resolvedCity = input.city;

		if (input.city) {
			const coords = await geocodeCity(input.city);
			if (!coords) {
				return {
					error: `Could not find coordinates for "${input.city}". Please check the city name.`,
				};
			}
			latitude = coords.latitude;
			longitude = coords.longitude;
		} else if (input.latitude !== undefined && input.longitude !== undefined) {
			latitude = input.latitude;
			longitude = input.longitude;
		} else {
			return {
				error:
					"Please provide either a city name or both latitude and longitude coordinates.",
			};
		}

		const response = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
		);

		const weatherData = await response.json();

		if (resolvedCity) {
			weatherData.cityName = resolvedCity;
		}

		return weatherData;
	},
	toModelOutput: async ({ input, output }) => {
		// Send a concise summary to the model instead of the full API response
		// This reduces token usage while preserving the full data for UI rendering
		if ("error" in output) {
			return {
				type: "text" as const,
				value: output.error,
			};
		}

		const location = input.city ?? `${input.latitude}, ${input.longitude}`;
		const temp = output.current?.temperature_2m;
		const unit = output.current_units?.temperature_2m ?? "°C";

		return {
			type: "text" as const,
			value: `Weather in ${location}: ${temp}${unit}. Sunrise: ${output.daily?.sunrise?.[0] ?? "N/A"}, Sunset: ${output.daily?.sunset?.[0] ?? "N/A"}.`,
		};
	},
});
