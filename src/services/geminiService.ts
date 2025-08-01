import { AnalysisResult, QuestionResult } from "@/components/StudyAssistant";
import { extractTextFromPdfPage, extractPageRangeFromOcr } from "@/utils/pdfReader";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyAwPyxCmxk6oovqNuwCyK5AOjdgepuTXzk";

export const analyzeImage = async (file: File, outputLanguage: "english" | "tamil" = "english"): Promise<AnalysisResult> => {
  try {
    const base64Image = await convertToBase64(file);
    
    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language. Use Tamil script for all content."
      : "Please provide all responses in English language.";

    const prompt = `
Analyze this image for TNPSC (Tamil Nadu Public Service Commission) exam preparation.

${languageInstruction}

CRITICAL INSTRUCTIONS:
- Extract ONLY specific, factual, and concrete information directly from the content
- DO NOT include generic statements about importance or what needs to be studied
- Focus on actual facts: names, dates, events, definitions, processes, figures, laws, etc.
- Provide practical memory tips for each study point to help with retention

Please provide a comprehensive analysis in the following JSON format:
{
  "mainTopic": "Main topic of the content",
  "studyPoints": [
    {
      "title": "Key point title",
      "description": "Detailed description",
      "importance": "high/medium/low",
      "tnpscRelevance": "TNPSC relevance explanation",
      "tnpscPriority": "high/medium/low",
      "memoryTip": "Easy memory tip for students"
    }
  ],
  "keyPoints": ["Specific factual point 1", "Specific factual point 2", ...],
  "summary": "Overall summary of the content",
  "tnpscRelevance": "How this content is relevant for TNPSC exams",
  "tnpscCategories": ["Category1", "Category2", ...],
  "difficulty": "easy/medium/hard"
}

Focus on:
- TNPSC Group 1, 2, 4 exam relevance
- Extracting specific facts, figures, names, dates, and definitions
- Important dates, names, places
- Conceptual understanding
- Application in exam context
- Make key points factual and specific from the actual content
- Provide creative memory tips using mnemonics, associations, or patterns
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64Image.split(',')[1]
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    console.log('Raw Gemini response:', content);

    // Clean and parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);
    
    return {
      keyPoints: result.keyPoints || [],
      summary: result.summary || '',
      tnpscRelevance: result.tnpscRelevance || '',
      studyPoints: result.studyPoints || [],
      tnpscCategories: result.tnpscCategories || []
    };
  } catch (error) {
    console.error('Error analyzing image:', error);
    throw error;
  }
};

export const generateQuestions = async (
  analysisResults: AnalysisResult[],
  difficulty: string = "medium",
  outputLanguage: "english" | "tamil" = "english"
): Promise<QuestionResult> => {
  try {
    const combinedContent = analysisResults.map(result => ({
      keyPoints: result.keyPoints.join('\n'),
      summary: result.summary,
      tnpscRelevance: result.tnpscRelevance
    }));

    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all questions and answers in Tamil language."
      : "Please provide all questions and answers in English language.";

    const prompt = `
Based on the following TNPSC study content, generate 15-20 comprehensive questions:

Content Analysis:
${combinedContent.map((content, index) => `
Analysis ${index + 1}:
Key Points: ${content.keyPoints}
Summary: ${content.summary}
TNPSC Relevance: ${content.tnpscRelevance}
`).join('\n')}

Difficulty Level: ${difficulty}
${languageInstruction}

CRITICAL INSTRUCTIONS:
- Generate questions ONLY from the specific facts and information provided in the key points and summary above
- DO NOT create questions about the importance of content or general study advice
- Focus on testing factual knowledge, specific details, and understanding of the provided content
- Questions should test recall of names, dates, events, definitions, and concepts mentioned in the material

Generate ONLY these types of questions:
- Multiple choice questions (4 options each) - 70%
- Assertion-Reason questions - 30%

For MCQ questions, provide 4 clear options (A, B, C, D).
IMPORTANT: The "answer" field should contain ONLY the option letter (A, B, C, or D), not the full option text.

For Assertion-Reason questions, provide:
- Assertion statement
- Reason statement  
- 4 options: (A) Both assertion and reason are true and reason is correct explanation (B) Both assertion and reason are true but reason is not correct explanation (C) Assertion is true but reason is false (D) Both assertion and reason are false

Return as a JSON array:
[
  {
    "question": "Question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "A",
    "type": "mcq" | "assertion_reason",
    "difficulty": "${difficulty}",
    "tnpscGroup": "Group 1" | "Group 2" | "Group 4",
    "explanation": "Brief explanation of the answer"
  }
]

Ensure questions test:
- Specific factual knowledge from the provided key points
- Conceptual understanding  
- Application ability
- TNPSC exam pattern relevance
- Based on the actual content and facts provided in the analysis

CRITICAL: Make sure the "answer" field contains only the letter (A, B, C, or D) that corresponds to the correct option.
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    console.log('Raw questions response:', content);

    // Clean and parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const questions = JSON.parse(cleanedContent);
    
    // Ensure all questions have the correct type format and proper options
    const formattedQuestions = questions.map((q: any) => ({
      ...q,
      type: q.type === "short" ? "mcq" : q.type,
      options: Array.isArray(q.options) ? q.options : ["Option A", "Option B", "Option C", "Option D"],
      answer: q.answer || "A"
    }));

    const result: QuestionResult = {
      questions: formattedQuestions,
      summary: combinedContent.map(c => c.summary).join(' '),
      keyPoints: analysisResults.flatMap(r => r.keyPoints),
      difficulty,
      totalQuestions: formattedQuestions.length
    };

    return result;
  } catch (error) {
    console.error('Error generating questions:', error);
    throw error;
  }
};

export const generatePageAnalysis = async (
  file: File,
  pageNumber: number,
  outputLanguage: "english" | "tamil" = "english"
): Promise<{
  page: number;
  keyPoints: string[];
  summary: string;
  importance: "high" | "medium" | "low";
  tnpscRelevance: string;
}> => {
  try {
    const textContent = await extractTextFromPdfPage(file, pageNumber);
    
    if (!textContent.trim()) {
      throw new Error('No text content found on this page');
    }

    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language."
      : "Please provide all responses in English language.";

    const prompt = `
Analyze this PDF page content for TNPSC exam preparation:

${languageInstruction}

Content: ${textContent}

Please provide analysis in JSON format:
{
CRITICAL INSTRUCTIONS:
- Extract ONLY specific, factual, and concrete information directly from the content
- DO NOT include generic statements about importance or what needs to be studied
- Focus on actual facts: names, dates, events, definitions, processes, figures, laws, etc.
- Provide practical memory tips for each study point to help with retention

  "keyPoints": ["Specific factual point 1", "Specific factual point 2", ...],
  "summary": "Brief summary of the page content",
  "importance": "high/medium/low",
  "tnpscRelevance": "How this content relates to TNPSC exams"
}

Focus on:
- TNPSC exam relevance
- Extracting specific facts, names, dates, and concrete information
- Key information for study
- Make key points factual and specific from the actual content
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);
    
    return {
      page: pageNumber,
      keyPoints: analysis.keyPoints || [],
      summary: analysis.summary || '',
      importance: analysis.importance || 'medium',
      tnpscRelevance: analysis.tnpscRelevance || ''
    };
  } catch (error) {
    console.error('Error analyzing page:', error);
    throw error;
  }
};

export const analyzePdfContentComprehensive = async (
  textContent: string,
  outputLanguage: "english" | "tamil" = "english"
): Promise<{
  pageAnalyses: Array<{
    pageNumber: number;
    keyPoints: string[];
    studyPoints: Array<{
      title: string;
      description: string;
      importance: "high" | "medium" | "low";
      tnpscRelevance: string;
    }>;
    summary: string;
    tnpscRelevance: string;
  }>;
  overallSummary: string;
  totalKeyPoints: string[];
  tnpscCategories: string[];
}> => {
  try {
    const pageAnalyses = [];
    const allKeyPoints: string[] = [];
    const allCategories: string[] = [];
    
    // Extract individual pages from the OCR text
    const pageRegex = /==Start of OCR for page (\d+)==([\s\S]*?)==End of OCR for page \1==/g;
    const pageMatches = Array.from(textContent.matchAll(pageRegex));
    
    console.log(`Found ${pageMatches.length} pages to analyze`);
    
    // Process pages in batches to avoid API limits
    const batchSize = 5;
    for (let i = 0; i < pageMatches.length; i += batchSize) {
      const batch = pageMatches.slice(i, i + batchSize);
      
      for (const match of batch) {
        const pageNumber = parseInt(match[1], 10);
        const pageContent = match[2].trim();
        
        if (pageContent.length < 50) continue; // Skip pages with minimal content
        
        const languageInstruction = outputLanguage === "tamil" 
          ? "Please provide all responses in Tamil language."
          : "Please provide all responses in English language.";

        const prompt = `
Analyze this PDF page content for TNPSC exam preparation:

${languageInstruction}

Page ${pageNumber} Content: ${pageContent.substring(0, 4000)}

Please provide analysis in JSON format:
{
CRITICAL INSTRUCTIONS:
- Extract ONLY specific, factual, and concrete information directly from the content
- DO NOT include generic statements about importance or what needs to be studied
- Focus on actual facts: names, dates, events, definitions, processes, figures, laws, etc.
- Provide practical memory tips for each study point to help with retention

CRITICAL INSTRUCTIONS:
- Extract ONLY specific, factual, and concrete information directly from the content
- DO NOT include generic statements about importance or what needs to be studied
- Focus on actual facts: names, dates, events, definitions, processes, figures, laws, etc.
- Provide practical memory tips for each study point to help with retention

  "keyPoints": ["Short crisp key point 1", "Short crisp key point 2", "Short crisp key point 3", "Short crisp key point 4", "Short crisp key point 5"],
  "studyPoints": [
    {
      "title": "Study point title",
      "description": "Detailed description",
      "importance": "high/medium/low",
      "tnpscRelevance": "TNPSC relevance explanation"
    }
  ],
  "summary": "Brief summary of the page content",
  "tnpscRelevance": "How this content relates to TNPSC exams",
  "tnpscCategories": ["Category1", "Category2"]
}

Focus on:
- Extract at least 5 short crisp key points per page for easy memorization
- TNPSC exam relevance
- Important facts and concepts
- Key information for study
`;

        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
              }
            })
          });

          if (!response.ok) {
            console.error(`Failed to analyze page ${pageNumber}`);
            continue;
          }

          const data = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (!content) {
            console.error(`No content received for page ${pageNumber}`);
            continue;
          }

          const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
          const analysis = JSON.parse(cleanedContent);
          
          pageAnalyses.push({
            pageNumber,
            keyPoints: analysis.keyPoints || [],
            studyPoints: analysis.studyPoints || [],
            summary: analysis.summary || '',
            tnpscRelevance: analysis.tnpscRelevance || ''
          });
          
          allKeyPoints.push(...(analysis.keyPoints || []));
          allCategories.push(...(analysis.tnpscCategories || []));
          
        } catch (error) {
          console.error(`Error analyzing page ${pageNumber}:`, error);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Generate overall summary
    const overallSummary = `Comprehensive analysis of ${pageAnalyses.length} pages with ${allKeyPoints.length} total key points identified.`;
    
    return {
      pageAnalyses,
      overallSummary,
      totalKeyPoints: allKeyPoints,
      tnpscCategories: [...new Set(allCategories)]
    };
  } catch (error) {
    console.error('Error in comprehensive PDF analysis:', error);
    throw error;
  }
};

export const analyzePdfContent = async (
  textContent: string,
  outputLanguage: "english" | "tamil" = "english"
): Promise<AnalysisResult> => {
  try {
    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language. Use Tamil script for all content."
      : "Please provide all responses in English language.";

    const prompt = `
Analyze this PDF text content for TNPSC (Tamil Nadu Public Service Commission) exam preparation.

${languageInstruction}

Content: ${textContent.substring(0, 8000)}

Please provide a comprehensive analysis in the following JSON format:
{
CRITICAL INSTRUCTIONS:
- Extract ONLY specific, factual, and concrete information directly from the content
- DO NOT include generic statements about importance or what needs to be studied
- Focus on actual facts: names, dates, events, definitions, processes, figures, laws, etc.
- Provide practical memory tips for each study point to help with retention

  "mainTopic": "Main topic of the content",
  "studyPoints": [
    {
      "title": "Key point title",
      "description": "Detailed description",
      "importance": "high/medium/low",
      "tnpscRelevance": "TNPSC relevance explanation",
      "tnpscPriority": "high/medium/low",
      "memoryTip": "Easy memory tip for students"
    }
  ],
  "keyPoints": ["Specific factual point 1", "Specific factual point 2", ...],
  "summary": "Overall summary of the content",
  "tnpscRelevance": "How this content is relevant for TNPSC exams",
  "tnpscCategories": ["Category1", "Category2", ...],
  "difficulty": "easy/medium/hard"
}

Focus on:
- TNPSC Group 1, 2, 4 exam relevance
- Extracting specific facts, figures, names, dates, and definitions
- Important dates, names, places
- Conceptual understanding
- Application in exam context
- Make key points factual and specific from the actual content
- Provide creative memory tips using mnemonics, associations, or patterns
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    console.log('Raw PDF analysis response:', content);

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(cleanedContent);
    
    return {
      keyPoints: result.keyPoints || [],
      summary: result.summary || '',
      tnpscRelevance: result.tnpscRelevance || '',
      studyPoints: result.studyPoints || [],
      tnpscCategories: result.tnpscCategories || []
    };
  } catch (error) {
    console.error('Error analyzing PDF content:', error);
    throw error;
  }
};

export const analyzeIndividualPage = async (
  textContent: string,
  pageNumber: number,
  outputLanguage: "english" | "tamil" = "english"
): Promise<{
  pageNumber: number;
  keyPoints: string[];
  studyPoints: Array<{
    title: string;
    description: string;
    importance: "high" | "medium" | "low";
    tnpscRelevance: string;
  }>;
  summary: string;
  tnpscRelevance: string;
}> => {
  try {
    const languageInstruction = outputLanguage === "tamil" 
      ? "Please provide all responses in Tamil language."
      : "Please provide all responses in English language.";

    const prompt = `
Analyze this individual PDF page content for TNPSC exam preparation:

${languageInstruction}

Page ${pageNumber} Content: ${textContent.substring(0, 4000)}

Please provide detailed analysis in JSON format:
{
  "keyPoints": ["Specific factual point 1", "Specific factual point 2", "Specific factual point 3", "Specific factual point 4", "Specific factual point 5", "Specific factual point 6", "Specific factual point 7", "Specific factual point 8"],
  "studyPoints": [
    {
      "title": "Study point title",
      "description": "Detailed description",
      "importance": "high/medium/low",
      "tnpscRelevance": "TNPSC relevance explanation",
      "memoryTip": "Easy memory tip for students"
  "keyPoints": ["Specific factual point 1", "Specific factual point 2", ...],
  ],
  "summary": "Brief summary of the page content",
  "tnpscRelevance": "How this content relates to TNPSC exams"
}

Focus on:
- Extract at least 8 specific factual key points per page from the actual content
- Detailed study points with TNPSC relevance
- Specific facts, names, dates, and concrete information
- Key information for study
- Make key points factual and specific from the actual content
- Definitions and explanations
- Statistical data and figures
- Historical context and significance
- Provide creative memory tips using mnemonics, associations, or patterns
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 3000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini API');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const analysis = JSON.parse(cleanedContent);
    
    return {
      pageNumber,
      keyPoints: analysis.keyPoints || [],
      studyPoints: analysis.studyPoints || [],
      summary: analysis.summary || '',
      tnpscRelevance: analysis.tnpscRelevance || ''
    };
  } catch (error) {
    console.error(`Error analyzing page ${pageNumber}:`, error);
    throw error;
  }
};

const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const analyzeMultipleImages = async (
  files: File[],
  difficulty: string = "medium",
  outputLanguage: "english" | "tamil" = "english"
): Promise<QuestionResult> => {
  try {
    const analysisResults: AnalysisResult[] = [];
    
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const result = await analyzeImage(file, outputLanguage);
        analysisResults.push(result);
      }
    }
    
    if (analysisResults.length === 0) {
      throw new Error('No valid images found for analysis');
    }
    
    const questionResult = await generateQuestions(analysisResults, difficulty, outputLanguage);
    return questionResult;
  } catch (error) {
    console.error('Error in analyzeMultipleImages:', error);
    throw error;
  }
};