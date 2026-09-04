import { createClient } from "@libsql/client";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../drizzle/0000_oval_genesis.sql", import.meta.url), "utf8");
const client = createClient({ url: "file:./.migration-verify.db" });
for (const statement of sql.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) await client.execute(statement);
const tables = await client.execute("select name from sqlite_master where type='table' order by name");
console.log(tables.rows.map(row => row.name).join(","));
