import { cleanup } from "@testing-library/react";
import React from "react";
import { afterEach, vi } from "vitest";

// Set dummy POSTGRES_URL for tests that import database modules
process.env["POSTGRES_URL"] = "postgres://test:test@localhost:5432/test";

Object.defineProperty(process.env, "NODE_ENV", {
	value: "test",
	configurable: true,
	writable: true,
	enumerable: true,
});

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
	value: ResizeObserverStub,
	writable: true,
});

Object.defineProperty(window, "matchMedia", {
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
	writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
	value: vi.fn(),
	writable: true,
});

Object.defineProperty(Element.prototype, "scrollTo", {
	value: vi.fn(),
	writable: true,
});

if (!globalThis.requestAnimationFrame) {
	globalThis.requestAnimationFrame = (callback: FrameRequestCallback) =>
		setTimeout(callback, 0);
}

const localStorageStore = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
	value: {
		getItem: (key: string) => localStorageStore.get(key) ?? null,
		setItem: (key: string, value: string) => {
			localStorageStore.set(key, value);
		},
		removeItem: (key: string) => {
			localStorageStore.delete(key);
		},
		clear: () => {
			localStorageStore.clear();
		},
	},
	writable: true,
});

vi.mock("next/image", () => ({
	default: ({ alt = "", ...props }: { alt?: string; src: string }) =>
		React.createElement("img", { alt, ...props }),
}));

vi.mock("server-only", () => ({}));

afterEach(() => {
	cleanup();
	localStorageStore.clear();
	vi.unstubAllGlobals();
});
