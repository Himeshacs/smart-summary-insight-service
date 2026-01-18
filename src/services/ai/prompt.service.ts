class PromptService {
  buildAnalysisPrompt(
    structuredData: Record<string, any>,
    notes: string[],
  ): string {

    // Convert structured data to readable format
    const structuredDataStr = JSON.stringify(structuredData, null, 2);

    // Format notes
    const notesStr = notes.map((note, i) => `${i + 1}. ${note}`).join("\n");

    const prompt = `
ROLE: You are an expert operations analyst for Central Park Puppies, a premium pet services company.

TASK: Analyze the provided structured data and free-text notes to generate:
1. A CONCISE SUMMARY (2-3 sentences maximum)
2. KEY INSIGHTS (3-5 bullet points, focus on operational impact)
3. RECOMMENDED NEXT ACTIONS (2-3 actionable items with owners if possible)

STRUCTURED DATA:
${structuredDataStr}

FREE-TEXT NOTES:
${notesStr}

ANALYSIS GUIDELINES:
- Focus on operational efficiency, customer satisfaction, and risk mitigation
- Identify patterns, anomalies, and opportunities
- Be specific, actionable, and practical
- Consider business context (pet services, customer experience, operations)
- Maintain professional but approachable tone

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "summary": "string (2-3 sentences)",
  "key_insights": ["string", "string", "string"],
  "next_actions": ["string", "string", "string"],
  "confidence_score": number (0.0-1.0, estimate of analysis quality)
}

EXAMPLES:
Good insight: "Customer has experienced 3 delivery delays in 2 weeks, indicating potential logistics issues"
Good action: "Schedule follow-up call with customer within 24 hours to discuss compensation options"

IMPORTANT: Respond ONLY with valid JSON. No additional text.
    `.trim();

    return prompt;
  }
}

export default new PromptService();
