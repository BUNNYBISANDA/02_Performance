import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import { getWeeklyTrend } from "../services/qualityQueries.js";

export const weeklyRouter = Router();

weeklyRouter.get("/weekly-trend", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    const trend = await getWeeklyTrend(filters);
    res.json(trend);
  } catch (error) {
    next(error);
  }
});
