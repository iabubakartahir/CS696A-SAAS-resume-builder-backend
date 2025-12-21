import OpenAI from "openai";

let openaiInstance;
const getOpenAI = () => {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing OPENAI_API_KEY. Set it in your environment (.env)"
      );
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
};

export const suggestAIContent = async (field, jobDescription) => {
  const prompt = `
You are an expert resume writer.
Generate professional ${field} suggestions based on this job description:
---
${jobDescription}
---
Return only the plain text.
`;
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });
  return response.choices[0].message.content.trim();
};
