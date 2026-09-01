import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../lib/asyncHandler";
import { saveUploadedDocument, runExtraction, confirmField } from "./extraction.service";
import { ApiError } from "../../middleware/error.middleware";
import { z } from "zod";

export const extractionRouter = Router();
extractionRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB, matches original drop-zone copy
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") return cb(new ApiError(400, "Only PDF files are accepted") as any);
    cb(null, true);
  },
});

extractionRouter.post(
  "/plans/:planId/documents",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "No file uploaded");
    const doc = await saveUploadedDocument(req.params.planId, req.file);
    res.status(201).json(doc);
  }),
);

extractionRouter.post(
  "/documents/:documentId/extract",
  asyncHandler(async (req, res) => {
    const result = await runExtraction(req.params.documentId);
    res.json(result);
  }),
);

const ConfirmSchema = z.object({ fieldPath: z.string().min(1) });

extractionRouter.post(
  "/plans/:planId/provenance/confirm",
  asyncHandler(async (req, res) => {
    const { fieldPath } = ConfirmSchema.parse(req.body);
    const result = await confirmField(req.params.planId, fieldPath);
    res.json(result);
  }),
);
