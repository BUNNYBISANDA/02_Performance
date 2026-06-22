import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import { getOverview } from "../services/qualityQueries.js";

export const overviewRouter = Router();

overviewRouter.get("/overview", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    const overview = await getOverview(filters);
    res.json(overview);
  } catch (error) {
    next(error);
  }
});
