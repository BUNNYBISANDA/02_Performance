import { Router } from "express";
import { parseQualityFilters } from "../services/qualityFilters.js";
import {
  getDebugDistinctValues,
  getDebugFilterTest,
  getDebugRowCounts,
  getPowerBiValidation,
  getRelationshipAudit,
} from "../services/debugQueries.js";

export const debugRouter = Router();

debugRouter.get("/debug/row-counts", async (_req, res, next) => {
  try {
    res.json(await getDebugRowCounts());
  } catch (error) {
    next(error);
  }
});

debugRouter.get("/debug/distinct-values", async (_req, res, next) => {
  try {
    res.json(await getDebugDistinctValues());
  } catch (error) {
    next(error);
  }
});

debugRouter.get("/debug/filter-test", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    res.json(await getDebugFilterTest(filters));
  } catch (error) {
    next(error);
  }
});

debugRouter.get("/debug/relationship-audit", async (_req, res, next) => {
  try {
    res.json(await getRelationshipAudit());
  } catch (error) {
    next(error);
  }
});

debugRouter.get("/debug/powerbi-validation", async (req, res, next) => {
  try {
    const filters = parseQualityFilters(req.query as Record<string, string | string[] | undefined>);
    res.json(await getPowerBiValidation(filters));
  } catch (error) {
    next(error);
  }
});
