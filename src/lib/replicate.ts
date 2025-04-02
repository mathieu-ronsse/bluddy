interface ReplicateResponse {
  status: string;
  output: string | string[];
  error?: string;
}

export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    console.log('\n=== Starting PDF Text Extraction ===');
    console.log('PDF URL:', pdfUrl);

    const requestBody = {
      input: {
        pdf: pdfUrl
      }
    };

    console.log('Making prediction request with body:', JSON.stringify(requestBody, null, 2));

    // Start the prediction using our proxy endpoint
    const response = await fetch('/api/replicate/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);
    const result: ReplicateResponse = await response.json();
    console.log('Response data:', JSON.stringify(result, null, 2));

    if (!response.ok || result.error) {
      throw new Error(result.error || `Failed to analyze PDF: ${response.statusText}`);
    }

    if (!result.output) {
      throw new Error('No output received from PDF analysis');
    }

    return Array.isArray(result.output) ? result.output.join('\n') : String(result.output);
  } catch (error) {
    console.error('Error analyzing PDF:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred during PDF analysis');
  }
}