import crypto from "crypto";

class Helpers {
  // Generate a unique cache key from input data
   
  generateCacheKey(structuredData: Record<string, any>, notes: string | string[]): string {
    const dataString = JSON.stringify(structuredData);
    const notesString = Array.isArray(notes) ? notes.join("|") : notes;

    // Create hash of the combined data
    const hash = crypto
      .createHash("md5")
      .update(dataString + notesString)
      .digest("hex");

    return `analysis:${hash}`;
  }

}

export default new Helpers();
