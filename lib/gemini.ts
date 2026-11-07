export function getGeminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEYが未設定です。.env.localを設定して開発サーバーを再起動してください。');
  }
  return { apiKey, model };
}
