import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import { getFilterOptions } from "../services/qualityQueries.js";

export const filtersRouter = Router();

filtersRouter.get("/filters", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    const options = await getFilterOptions(filters);
    res.json(options);
  } catch (error) {
    next(error);
  }
});
