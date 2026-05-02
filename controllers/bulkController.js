import { processBulkUploads } from "../middleware/bulkProcessor.js";

export const triggerBulkProcessing = async (req, res) => {
  try {
    console.log("Manual bulk processing triggered via API...");
    const result = await processBulkUploads(req);

    res.status(200).json({
      success: true,
      message: "Bulk processing triggered successfully.",
      details: result || "Started processing files in upload directory.",
    });
  } catch (err) {
    console.error("❌ Error during bulk processing:", err);
    res.status(500).json({
      success: false,
      message: "Error while running bulk processing.",
      error: err.message,
    });
  }
};
