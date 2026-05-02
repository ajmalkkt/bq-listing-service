import fs from "fs";
import path from "path";

/**
 * Quickly check if directory exists and list files (synchronously).
 * Returns [] if directory doesn't exist or no files found.
 */
export const getFilesIfExists = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      console.warn(`[getFilesIfExists] Directory not found: ${dirPath}`);
      return [];
    }

    const files = fs.readdirSync(dirPath);
    if (!files || files.length === 0) {
      console.log(`[getFilesIfExists] No files found in ${dirPath}`);
      return [];
    }

    return files;
  } catch (err) {
    console.error(`[getFilesIfExists] Error reading directory: ${err.message}`);
    return [];
  }
};

/**
 * Checks if at least one file exists in the directory.
 * Returns true/false safely.
 */
export const hasFiles = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) return false;
    const files = fs.readdirSync(dirPath);
    return files && files.length > 0;
  } catch (err) {
    console.error(`[hasFiles] Error checking directory: ${err.message}`);
    return false;
  }
};
