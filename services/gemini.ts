import { GoogleGenAI } from "@google/genai";
import { getApiKey } from "./apiKeyManager";

export async function generateDiagramCode(userDescription: string, userId: string, apiKeyOverride?: string): Promise<string> {
  // Try to get user's encrypted API key first
  let apiKey = apiKeyOverride;

  if (!apiKey && userId) {
    try {
      apiKey = await getApiKey(userId);
    } catch (error) {
      console.error("Failed to retrieve API key:", error);
    }
  }

  if (!apiKey) {
    console.error("API Key missing");
    return "graph TD; A[Error] --> B[Missing API Key - Please add your key in Admin Panel];";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    const prompt = `
      Generate a valid Mermaid.js flowchart code based on the following business logic or process description.
      
      Description: "${userDescription}"
      
      Requirements:
      1. Return ONLY the Mermaid code. 
      2. Do not include markdown code fences (like \`\`\`mermaid).
      3. Use 'graph TD' or 'graph LR' direction.
      4. Make the diagram logic clear and professional.
      5. Do not include any conversational text, just the code.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    let code = response.text || "";
    // Cleanup if model adds markdown despite instructions
    code = code.replace(/```mermaid/g, '').replace(/```/g, '').trim();
    
    return code;
  } catch (error) {
    console.error("Error generating diagram:", error);
    return "graph TD; A[Error] --> B[Failed to generate diagram];";
  }
}
