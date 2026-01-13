
import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "./types";

export const processFileToQuestions = async (
  fileBase64: string, 
  mimeType: string, 
  excludeTexts: string[] = []
): Promise<Question[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  let finalMimeType = mimeType;
  if (mimeType.includes('pdf')) {
    finalMimeType = 'application/pdf';
  } else if (mimeType.includes('wordprocessingml') || mimeType.includes('docx') || mimeType.includes('doc')) {
    finalMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  const filePart = {
    inlineData: {
      data: fileBase64,
      mimeType: finalMimeType,
    },
  };

  // Modelga qat'iy ko'rsatma: ushbu savollarni mutlaqo qaytarma
  const excludePrompt = excludeTexts.length > 0 
    ? `\nMUHIM: QUYIDAGI MATNLI SAVOLLAR ALLAQACHON ISHLATILGAN, ULARNI QAYTA ISHLATMA (YANGI SAVOLLARNI TANLA):\n${excludeTexts.join('\n')}\n` 
    : '';

  const textPart = {
    text: `Ushbu hujjat ichidagi testlarni tahlil qil va savollarni ajratib ol.
    ${excludePrompt}
    
    MUHIM VA QAT'IY TALABLAR:
    1. FAYLDAN JAMI 30 TA YANGI SAVOL AJRATIB OL. Avval ishlatilgan (exclude qilingan) savollarni mutlaqo tashlab ket.
    2. SAVOL MATNINI FAYLDA QANDAY BO'LSA, SHUNDAYLIGICHA KO'CHIR.
    3. JAVOB VARIANTLARINI ALMASHTIRIB (SHUFFLE QILIB) BER.
    4. VARIANTLARNI ALMASHTIRGANDA, "correctAnswer" QIYMATI YANGI TARTIBGA MOS KELISHINI TEKSHIR.
    5. Explanation (izoh) qismida nima uchun aynan shu javob to'g'riligini tushuntir.
    6. Faqat o'zbek tilida, toza JSON formatida javob ber.`
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", 
      contents: { parts: [filePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              question: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING },
                },
                required: ["A", "B", "C", "D"],
              },
              correctAnswer: { 
                type: Type.STRING,
                enum: ["A", "B", "C", "D"]
              },
              explanation: { type: Type.STRING },
            },
            required: ["id", "question", "options", "correctAnswer", "explanation"],
          },
        },
      },
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    throw error;
  }
};
