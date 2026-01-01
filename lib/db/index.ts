import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getPostgresUrl } from "../config/server";

const client = postgres(getPostgresUrl());
export const db = drizzle(client);
