import { z } from "zod";
import raw from "@/config/connectors.json";
import type { Connector } from "@/lib/types";

/**
 * connectors.json is hand-edited config, so it gets validated once at import
 * rather than cast. A typo in `status` would otherwise type-check fine and then
 * throw at render when STATE[conn.status] came back undefined.
 */
const ConnectorSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string(),
  chip: z.enum(["light", "dark"]),
  kind: z.string(),
  /** What the system holds — grounds the model when asked about it. */
  entities: z.array(z.string()).default([]),
  status: z.enum(["live", "syncing", "error", "unconfigured"]),
  objects: z.number().nullable(),
  lastSync: z.string().nullable(),
});

const parsed = z.array(ConnectorSchema).safeParse(raw.connectors);

if (!parsed.success) {
  throw new Error(
    `config/connectors.json is invalid: ${parsed.error.issues
      .map((i) => `${i.path.join(".")} — ${i.message}`)
      .join("; ")}`
  );
}

export const connectors: Connector[] = parsed.data;
