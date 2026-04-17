import { defineConfig } from "@prisma/config";

export default defineConfig({
  datasource: {
    url: "file:./dev.db",
  },
  // Ensure we point to the schema location
  schema: "prisma/schema.prisma",
});
