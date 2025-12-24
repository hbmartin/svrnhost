import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getUser } from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type UserType = "regular";

declare module "next-auth" {
	interface Session extends DefaultSession {
		user: {
			id: string;
			type: UserType;
		} & DefaultSession["user"];
	}

	// biome-ignore lint/nursery/useConsistentTypeDefinitions: "Required"
	interface User {
		id?: string;
		email?: string | null;
		type: UserType;
	}
}

declare module "next-auth/jwt" {
	interface JWT extends DefaultJWT {
		id: string;
		type: UserType;
	}
}

export const {
	handlers: { GET, POST },
	auth,
	signIn,
	signOut,
} = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			async authorize(credentials) {
				const email = credentials?.email;
				const password = credentials?.password;
				if (typeof email !== "string" || typeof password !== "string") {
					return null;
				}

				const users = await getUser(email);

				const user = users.at(0);

				if (!user) {
					await compare(password, DUMMY_PASSWORD);
					return null;
				}

				if (!user.password) {
					await compare(password, DUMMY_PASSWORD);
					return null;
				}

				const passwordsMatch = await compare(password, user.password);

				if (!passwordsMatch) {
					return null;
				}

				return { ...user, type: "regular" };
			},
		}),
	],
	callbacks: {
		jwt({ token, user }) {
			if (user) {
				token.id = user.id as string;
				token.type = user.type;
			}

			return token;
		},
		session({ session, token }) {
			if (session.user) {
				session.user.id = token.id;
				session.user.type = token.type;
			}

			return session;
		},
	},
});
