import cors from "cors";
import dotenv from "dotenv";
import express, { type ErrorRequestHandler } from "express";
import { timedQuery } from "./db/timedQuery.js";
import { defectsRouter } from "./routes/defects.routes.js";
import { debugRouter } from "./routes/debug.routes.js";
import { filtersRouter } from "./routes/filters.routes.js";
import { linesRouter } from "./routes/lines.routes.js";
import { overviewRouter } from "./routes/overview.routes.js";
import { stageRouter } from "./routes/stage.routes.js";
import { weeklyRouter } from "./routes/weekly.routes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    credentials: true,
  }),
);
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    console.info(
      `[http] ${req.method} ${req.path} status=${res.statusCode} duration=${Math.round(performance.now() - startedAt)}ms query=${JSON.stringify(req.query)}`,
    );
  });

  next();
});

app.get("/api/health", async (_req, res) => {
  try {
    const dbResult = await timedQuery<{ ok: number }>("health", "SELECT 1 AS ok");
    res.json({
      status: "ok",
      db: dbResult.rows[0]?.ok === 1 ? "ok" : "unknown",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      db: "error",
      message: error instanceof Error ? error.message : "Unknown database error",
      timestamp: new Date().toISOString(),
    });
  }
});

app.use("/api", filtersRouter);
app.use("/api", debugRouter);
app.use("/api", overviewRouter);
app.use("/api", weeklyRouter);
app.use("/api", defectsRouter);
app.use("/api", linesRouter);
app.use("/api", stageRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal Server Error" : "Bad Request",
    message: error instanceof Error ? error.message : "Unknown error",
  });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`O2 Quality backend listening on http://localhost:${port}`);
});
