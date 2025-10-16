declare module '@google/genai' {
  export class GoogleGenAI {
    constructor(config?: { apiKey?: string });
    models: {
      generateContent(params: { model: string; contents: any; config?: any }): Promise<{ text: string }>
      generateContentStream(params: { model: string; contents: any; config?: any }): Promise<any>
    }
  }
}


