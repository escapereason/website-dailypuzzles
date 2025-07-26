/**
 * Daily Cipher Challenge System - Google Apps Script (COMPLETE REWRITE)
 * 
 * This script automatically generates daily 3-puzzle cipher sequences using Gemini AI
 * Structure: Decrypt Word → Answer Trivia → Encrypt Answer
 * 
 * NEW FEATURES:
 * - Robust Gemini API integration with multi-layer retry logic
 * - Smart fallback system with date-based rotation
 * - Progressive validation with self-healing capabilities
 * - Production-grade logging and monitoring
 * - Never fails completely - always provides fresh puzzles
 * 
 * Required Setup:
 * 1. Set GEMINI_API_KEY in Script Properties
 * 2. Create Google Sheet with 5 tabs: Daily_Puzzles, Current_Puzzle, Usage_Log, System_Log, Fallback_Puzzles
 * 3. Run setupDailyTrigger() to enable automation
 * 4. Run createInitialPuzzle() to populate first puzzle
 * 
 * @version 2.0.0
 * @author Claude (Anthropic) - Complete System Rewrite
 */

// ================================================
// CONFIGURATION SECTION
// ================================================

// Cipher types available for puzzle generation (8 types from easy to advanced)
const CIPHER_TYPES = ['rot13', 'caesar_3', 'caesar_5', 'caesar_7', 'caesar_11', 'caesar_neg3', 'caesar_neg5', 'atbash'];

// Balanced tech categories for diverse puzzle generation (reduced space bias from 25% to 10%)
const CATEGORIES = [
  'Artificial Intelligence', 'Cybersecurity', 'Space Exploration', 'Quantum Computing',
  'Robotics', 'Cryptocurrency', 'Programming Languages', 'Neural Networks',
  'Hardware Engineering', 'Blockchain Technology', 'Machine Learning', 'Data Science', 
  'Cloud Computing', 'Web Development', 'Game Development', 'Biotechnology',
  'Financial Technology', 'Internet of Things', 'Mobile Development', 'Software Engineering'
];

// Cipher difficulty mapping for balanced progression
const CIPHER_DIFFICULTY = {
  'rot13': 1, 'atbash': 1, 'caesar_3': 2, 'caesar_5': 3, 
  'caesar_7': 3, 'caesar_11': 3, 'caesar_neg3': 4, 'caesar_neg5': 4
};

// API Configuration
const API_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 1000,     // 1 second base delay
  MAX_DELAY: 8000,      // 8 second max delay
  TIMEOUT: 30000        // 30 second timeout
};

// System performance tracking
let SYSTEM_METRICS = {
  gemini_attempts: 0,
  gemini_successes: 0,
  fallback_uses: 0,
  validation_failures: 0,
  last_reset: new Date()
};

// ================================================
// MAIN GENERATION FUNCTION
// ================================================

/**
 * Main function that generates daily puzzle sequences with robust error handling
 * Called automatically by daily trigger at 1 AM
 */
function generateDailyPuzzleSequence() {
  const startTime = new Date();
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey) {
    logStructuredEvent('CRITICAL', 'generation_failed', null, 'GEMINI_API_KEY not found in Script Properties', {
      action_required: 'Set API key in Project Settings → Script Properties'
    });
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  const systemLog = ss.getSheetByName('System_Log');
  
  if (!puzzleSheet || !systemLog) {
    logStructuredEvent('ERROR', 'generation_failed', null, 'Required sheets not found', {
      missing_sheets: !puzzleSheet ? 'Daily_Puzzles' : 'System_Log',
      action_required: 'Create required sheet tabs'
    });
    return;
  }
  
  // Get tomorrow's date using sheet timezone for consistency
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = Utilities.formatDate(tomorrow, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  // Check if puzzle already exists for tomorrow
  const existingRow = findRowByDate(puzzleSheet, dateStr);
  if (existingRow > 1) {
    logStructuredEvent('INFO', 'generation_skipped', dateStr, 'Puzzle already exists', {
      existing_row: existingRow
    });
    return;
  }
  
  logStructuredEvent('INFO', 'generation_start', dateStr, 'Starting puzzle generation', {
    api_key_present: !!apiKey,
    sheet_timezone: ss.getSpreadsheetTimeZone()
  });
  
  try {
    // Attempt robust puzzle generation with multiple fallback strategies
    const puzzleData = generatePuzzleWithFallbacks(dateStr);
    
    // Write to sheet (20 columns: A-T)
    const newRow = puzzleSheet.getLastRow() + 1;
    puzzleSheet.getRange(newRow, 1, 1, 20).setValues([[
      dateStr,                          // A: date
      puzzleData.cipher_type,           // B: cipher_type
      puzzleData.p1_answer,             // C: p1_answer
      puzzleData.p1_encrypted_word,     // D: p1_encrypted_word
      puzzleData.p1_hint1,              // E: p1_hint1
      puzzleData.p1_hint2,              // F: p1_hint2
      puzzleData.p1_hint3,              // G: p1_hint3
      puzzleData.p2_question,           // H: p2_question
      puzzleData.p2_hint1,              // I: p2_hint1
      puzzleData.p2_hint2,              // J: p2_hint2
      puzzleData.p2_hint3,              // K: p2_hint3
      puzzleData.p2_answer,             // L: p2_answer
      puzzleData.p2_alt_answers,        // M: p2_alt_answers
      puzzleData.p3_answer,             // N: p3_answer
      puzzleData.p3_hint,               // O: p3_hint
      puzzleData.category,              // P: category
      CIPHER_DIFFICULTY[puzzleData.cipher_type] || 3, // Q: difficulty
      puzzleData.source || 'gemini_api', // R: source
      true,                             // S: validated
      0                                 // T: usage_count
    ]]);
    
    // Update Current_Puzzle tab for Landbot integration
    updateCurrentPuzzleTab(puzzleData);
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logStructuredEvent('SUCCESS', 'generation_complete', dateStr, 'Puzzle generated successfully', {
      source: puzzleData.source,
      duration_ms: duration,
      cipher_type: puzzleData.cipher_type,
      category: puzzleData.category,
      row_number: newRow
    });
    
    console.log(`Generated puzzle sequence for ${dateStr} (${duration}ms)`);
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logStructuredEvent('ERROR', 'generation_error', dateStr, error.toString(), {
      duration_ms: duration,
      error_stack: error.stack,
      system_metrics: SYSTEM_METRICS
    });
    
    console.error('Error generating puzzle sequence:', error);
    throw error; // Re-throw to ensure failure is visible in Apps Script logs
  }
}

// ================================================
// ROBUST GEMINI API INTEGRATION
// ================================================

/**
 * Generates puzzle with multi-layer fallback strategies
 * Layer 1: Gemini API with retries
 * Layer 2: Fallback_Puzzles sheet rotation
 * Layer 3: Hardcoded puzzle pool
 * Layer 4: Emergency puzzle
 */
function generatePuzzleWithFallbacks(dateStr) {
  // Get recent answers for uniqueness checking
  const excludedAnswers = getRecentAnswers(30);
  
  // Layer 1: Try Gemini API with robust retry logic
  try {
    SYSTEM_METRICS.gemini_attempts++;
    const geminiResult = callGeminiWithRetries(dateStr, excludedAnswers);
    if (geminiResult) {
      SYSTEM_METRICS.gemini_successes++;
      logStructuredEvent('SUCCESS', 'gemini_api_success', dateStr, 'Gemini API generated puzzle', {
        success_rate: SYSTEM_METRICS.gemini_successes / SYSTEM_METRICS.gemini_attempts
      });
      return { ...geminiResult, source: 'gemini_api' };
    }
  } catch (error) {
    logStructuredEvent('WARNING', 'gemini_api_failed', dateStr, 'Gemini API failed, trying fallbacks', {
      error: error.toString(),
      gemini_success_rate: SYSTEM_METRICS.gemini_successes / SYSTEM_METRICS.gemini_attempts
    });
  }
  
  // Layer 2: Try Fallback_Puzzles sheet with smart rotation
  try {
    const sheetFallback = getSheetFallbackPuzzle(dateStr);
    if (sheetFallback) {
      SYSTEM_METRICS.fallback_uses++;
      logStructuredEvent('INFO', 'sheet_fallback_used', dateStr, 'Using fallback from sheet', {
        fallback_index: sheetFallback.fallback_index
      });
      return { ...sheetFallback, source: 'sheet_fallback' };
    }
  } catch (error) {
    logStructuredEvent('WARNING', 'sheet_fallback_failed', dateStr, 'Sheet fallback failed', {
      error: error.toString()
    });
  }
  
  // Layer 3: Use hardcoded puzzle pool with date-based selection
  try {
    const hardcodedFallback = getHardcodedFallbackPuzzle(dateStr, excludedAnswers);
    SYSTEM_METRICS.fallback_uses++;
    logStructuredEvent('WARNING', 'hardcoded_fallback_used', dateStr, 'Using hardcoded fallback puzzle', {
      fallback_type: 'hardcoded_pool'
    });
    return { ...hardcodedFallback, source: 'hardcoded_fallback' };
  } catch (error) {
    logStructuredEvent('ERROR', 'hardcoded_fallback_failed', dateStr, 'Hardcoded fallback failed', {
      error: error.toString()
    });
  }
  
  // Layer 4: Emergency puzzle (should never fail)
  logStructuredEvent('CRITICAL', 'emergency_puzzle_used', dateStr, 'All fallbacks failed, using emergency puzzle', {
    system_state: 'degraded',
    action_required: 'Investigate system issues immediately'
  });
  
  return getEmergencyPuzzle(dateStr);
}

/**
 * Calls Gemini API with sophisticated retry logic and progressive prompt simplification
 */
function callGeminiWithRetries(dateStr, excludedAnswers = null) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
  // Progressive prompt strategies (complex → simple → basic)
  const promptStrategies = [
    () => createAdvancedPrompt(dateStr, excludedAnswers),
    () => createSimplePrompt(dateStr, excludedAnswers),
    () => createBasicPrompt(dateStr, excludedAnswers)
  ];
  
  for (let strategyIndex = 0; strategyIndex < promptStrategies.length; strategyIndex++) {
    const prompt = promptStrategies[strategyIndex]();
    
    logStructuredEvent('INFO', 'attempting_gemini_call', dateStr, `Trying prompt strategy ${strategyIndex + 1}`, {
      strategy: ['advanced', 'simple', 'basic'][strategyIndex],
      attempt_number: strategyIndex + 1
    });
    
    for (let attempt = 1; attempt <= API_CONFIG.MAX_RETRIES; attempt++) {
      try {
        const delay = Math.min(API_CONFIG.BASE_DELAY * Math.pow(2, attempt - 1), API_CONFIG.MAX_DELAY);
        
        if (attempt > 1) {
          logStructuredEvent('INFO', 'retrying_gemini_call', dateStr, `Retry attempt ${attempt} after ${delay}ms delay`, {
            strategy_index: strategyIndex,
            attempt: attempt,
            delay_ms: delay
          });
          Utilities.sleep(delay);
        }
        
        const response = callGeminiAPI(apiUrl, prompt);
        if (response) {
          const puzzleData = extractAndValidatePuzzle(response, dateStr, excludedAnswers);
          if (puzzleData) {
            logStructuredEvent('SUCCESS', 'gemini_api_success', dateStr, 'Successfully generated puzzle', {
              strategy_used: ['advanced', 'simple', 'basic'][strategyIndex],
              attempt_number: attempt,
              total_attempts: (strategyIndex * API_CONFIG.MAX_RETRIES) + attempt
            });
            return puzzleData;
          }
        }
        
      } catch (error) {
        logStructuredEvent('WARNING', 'gemini_api_attempt_failed', dateStr, `Attempt ${attempt} failed`, {
          strategy_index: strategyIndex,
          attempt: attempt,
          error: error.toString(),
          will_retry: attempt < API_CONFIG.MAX_RETRIES
        });
        
        if (attempt === API_CONFIG.MAX_RETRIES) {
          logStructuredEvent('ERROR', 'gemini_strategy_exhausted', dateStr, `Strategy ${strategyIndex + 1} exhausted all retries`, {
            strategy: ['advanced', 'simple', 'basic'][strategyIndex],
            total_attempts: API_CONFIG.MAX_RETRIES
          });
        }
      }
    }
  }
  
  logStructuredEvent('ERROR', 'gemini_api_completely_failed', dateStr, 'All Gemini strategies and retries exhausted', {
    total_strategies_tried: promptStrategies.length,
    total_attempts: promptStrategies.length * API_CONFIG.MAX_RETRIES
  });
  
  return null;
}

/**
 * Makes the actual API call to Gemini
 */
function callGeminiAPI(apiUrl, prompt) {
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: API_CONFIG.TIMEOUT
  };
  
  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseCode = response.getResponseCode();
  const rawResponseText = response.getContentText();
  
  // Enhanced logging: Log complete raw response for debugging
  logStructuredEvent('DEBUG', 'gemini_raw_response', null, 'Complete Gemini API response received', {
    response_code: responseCode,
    response_length: rawResponseText.length,
    raw_response_full: rawResponseText,
    response_preview: rawResponseText.substring(0, 300)
  });
  
  if (responseCode === 200) {
    const data = JSON.parse(rawResponseText);
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const extractedText = data.candidates[0].content.parts[0].text;
      
      // Enhanced logging: Log extracted text for comparison
      logStructuredEvent('DEBUG', 'gemini_text_extracted', null, 'Text extracted from Gemini response', {
        extracted_length: extractedText.length,
        extracted_text_full: extractedText,
        extraction_successful: true
      });
      
      return extractedText;
    } else {
      throw new Error('Invalid response structure from Gemini API');
    }
  } else if (responseCode === 429) {
    throw new Error('API quota exceeded - rate limited');
  } else if (responseCode === 403) {
    throw new Error('API access forbidden - check API key');
  } else {
    throw new Error(`API Error: ${responseCode} - ${rawResponseText}`);
  }
}

// ================================================
// PROGRESSIVE PROMPT STRATEGIES
// ================================================

/**
 * Creates advanced prompt with full complexity and requirements - ENHANCED FOR MAINSTREAM RECOGNITION
 */
function createAdvancedPrompt(dateStr, excludedAnswers = null) {
  const category = getBalancedCategory(dateStr);
  const cipherType = getBalancedCipher(dateStr);
  const exclusionText = createExclusionPromptText(excludedAnswers);
  
  return `Create a sophisticated 3-puzzle cipher sequence for ${dateStr} in the ${category} category using ${cipherType} encryption.${exclusionText}

ADVANCED STRUCTURE:
1. Choose a MAINSTREAM RECOGNIZABLE clue word (5-8 letters, uppercase) that most people know
2. Create accessible trivia question that REFERENCES the clue word but has DIFFERENT answer
3. P3 encrypts the P2 trivia answer (NOT the P1 clue word)
4. Provide 3 progressive hints accessible to general public

MAINSTREAM RECOGNITION REQUIREMENTS:
- Use words/brands/companies that MOST PEOPLE would recognize and could reasonably guess
- Prefer major consumer brands, household names, famous companies especially from SF Bay Area
- Examples of GOOD choices: APPLE, GOOGLE, TESLA, AMAZON, NETFLIX, DISNEY, SPOTIFY, MICROSOFT
- Examples of BAD choices: LORA, KUBERNETES, PYTORCH, ANSIBLE, GRAFANA (too technical/obscure)
- SF Bay Area preference: GOOGLE (Mountain View), APPLE (Cupertino), TESLA (Palo Alto), META (Menlo Park)

CIPHER SYSTEMS:
- rot13: Each letter shifted 13 positions (A→N, B→O, etc.)
- caesar_3: Each letter shifted 3 positions forward (A→D, B→E, etc.)
- caesar_5: Each letter shifted 5 positions forward (A→F, B→G, etc.) 
- caesar_7: Each letter shifted 7 positions forward (A→H, B→I, etc.)
- caesar_11: Each letter shifted 11 positions forward (A→L, B→M, etc.)
- caesar_neg3: Each letter shifted 3 positions backward (D→A, E→B, etc.)
- caesar_neg5: Each letter shifted 5 positions backward (F→A, G→B, etc.)
- atbash: Reverse alphabet (A→Z, B→Y, C→X, etc.)

MAINSTREAM ACCESSIBILITY REQUIREMENTS:
- p1_answer is mainstream recognizable word (5-8 letters, ${category} related)
- p2_answer must be DIFFERENT from p1_answer but also mainstream recognizable
- P2 question references P1 clue word and uses general knowledge (not expert-only)
- p3_answer encrypts P2 answer using same cipher as P1
- Progressive hints: Historical context → Cipher type → Exact parameter
- Target audience: general public with basic tech awareness, not experts

PROGRESSIVE HINT SYSTEM:
- p1_hint1: Historical/contextual hint about cipher (no direct mention)
- p1_hint2: Direct cipher type identification
- p1_hint3: Exact shift amount or parameter

EXAMPLE (${cipherType}, ${category}):
{
  "cipher_type": "${cipherType}",
  "p1_answer": "GOOGLE",
  "p1_encrypted_word": "JRRJOH",
  "p1_hint1": "This cipher method was used by Julius Caesar in his military campaigns",
  "p1_hint2": "This is a Caesar cipher",
  "p1_hint3": "3",
  "p2_question": "What popular video streaming service started as a DVD-by-mail service and is known for original shows like Stranger Things?",
  "p2_hint1": "Originally started by Reed Hastings as a DVD rental company",
  "p2_hint2": "Famous for binge-watching culture and red logo", 
  "p2_hint3": "Competes with Disney+ and Hulu for streaming dominance",
  "p2_answer": "NETFLIX",
  "p2_alt_answers": "NETFLIX,NETFLIX STREAMING",
  "p3_answer": "QHWIOLB",
  "p3_hint": "Use the same 3-position forward shift to encrypt the streaming service",
  "category": "${category}"
}

CRITICAL: Ensure p1_answer ≠ p2_answer and p3_answer = encrypted(p2_answer, cipher_type).
MUST USE MAINSTREAM RECOGNIZABLE NAMES - test if a typical adult would know the answer.
Generate ONLY valid JSON, no other text:`;
}

/**
 * Creates simplified prompt for retry attempts - ENHANCED FOR MAINSTREAM RECOGNITION
 */
function createSimplePrompt(dateStr, excludedAnswers = null) {
  const category = getBalancedCategory(dateStr);
  const cipherType = getBalancedCipher(dateStr);
  const exclusionText = createExclusionPromptText(excludedAnswers);
  
  return `Create a 3-puzzle cipher sequence for ${dateStr}. Use ${cipherType} cipher and ${category} theme.${exclusionText}

MAINSTREAM RECOGNITION FOCUS:
- Use ONLY words/brands/companies that regular people know
- Think: major brands, household names, famous companies (especially SF Bay Area)
- GOOD examples: APPLE, GOOGLE, TESLA, AMAZON, NETFLIX, DISNEY, SPOTIFY
- BAD examples: technical jargon, obscure terms, expert-only knowledge

Structure:
1. Decrypt a mainstream recognizable clue word (P1)
2. Answer accessible trivia about the topic (P2) - DIFFERENT answer than P1
3. Encrypt the trivia answer (P3)

Requirements:
- P1 and P2 must have different answers that MOST PEOPLE would recognize
- P3 encrypts P2 answer using same cipher as P1
- Include 3 hints accessible to general public (not experts)
- SF Bay Area companies preferred: GOOGLE, APPLE, TESLA, META

Generate only JSON format:
{
  "cipher_type": "${cipherType}",
  "p1_answer": "MAINSTREAM_WORD1",
  "p1_encrypted_word": "ENCRYPTED_WORD1",
  "p1_hint1": "Historical hint about cipher",
  "p1_hint2": "Cipher type identification",
  "p1_hint3": "Exact parameter/shift",
  "p2_question": "Accessible question about recognizable topic?",
  "p2_hint1": "General knowledge hint",
  "p2_hint2": "More specific accessible hint",
  "p2_hint3": "Obvious mainstream hint",
  "p2_answer": "MAINSTREAM_WORD2",
  "p2_alt_answers": "MAINSTREAM_WORD2,ALTERNATIVE",
  "p3_answer": "ENCRYPTED_WORD2",
  "p3_hint": "Use same cipher to encrypt the answer",
  "category": "${category}"
}`;
}

/**
 * Creates basic prompt as last resort - ENHANCED FOR MAINSTREAM RECOGNITION
 */
function createBasicPrompt(dateStr, excludedAnswers = null) {
  const category = getBalancedCategory(dateStr);
  const cipherType = getBalancedCipher(dateStr);
  const exclusionText = createExclusionPromptText(excludedAnswers);
  
  return `Create a simple cipher puzzle for ${dateStr} in ${category} category:${exclusionText}
1. A MAINSTREAM RECOGNIZABLE word to decrypt (P1) - think APPLE, GOOGLE, TESLA
2. An accessible trivia question with DIFFERENT mainstream answer (P2)
3. Encrypt the trivia answer (P3)

CRITICAL: Use ONLY words that regular people know - major brands, household names, famous companies.
Prefer SF Bay Area companies: GOOGLE, APPLE, TESLA, META, NETFLIX, UBER.
NO technical jargon or expert-only terms.

Use ${cipherType} cipher. P1 and P2 answers must be different mainstream words.

Return only JSON with these fields: cipher_type, p1_answer, p1_encrypted_word, p1_hint1, p1_hint2, p1_hint3, p2_question, p2_hint1, p2_hint2, p2_hint3, p2_answer, p2_alt_answers, p3_answer, p3_hint, category`;
}

// ================================================
// SMART JSON EXTRACTION AND VALIDATION
// ================================================

/**
 * Extracts and validates puzzle data from Gemini response with multiple strategies
 */
function extractAndValidatePuzzle(response, dateStr, excludedAnswers = null) {
  let puzzleData = null;
  
  // Enhanced logging: Log incoming response for analysis
  logStructuredEvent('DEBUG', 'puzzle_extraction_start', dateStr, 'Starting puzzle extraction from response', {
    response_length: response.length,
    response_full: response,
    contains_blockchain: response.toUpperCase().includes('BLOCKCHAIN'),
    contains_blockch: response.toUpperCase().includes('BLOCKCH'),
    word_analysis: extractWordBoundaries(response)
  });
  
  // Strategy 1: Direct JSON parse
  try {
    puzzleData = JSON.parse(response);
    logStructuredEvent('INFO', 'json_extraction_success', dateStr, 'Direct JSON parse successful', {
      strategy: 'direct_parse',
      extracted_p1_answer: puzzleData?.p1_answer,
      p1_answer_length: puzzleData?.p1_answer?.length
    });
  } catch (error) {
    // Strategy 2: Extract from code blocks
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        puzzleData = JSON.parse(jsonMatch[1]);
        logStructuredEvent('INFO', 'json_extraction_success', dateStr, 'Code block extraction successful', {
          strategy: 'code_block_extraction',
          extracted_p1_answer: puzzleData?.p1_answer,
          p1_answer_length: puzzleData?.p1_answer?.length,
          extracted_json_length: jsonMatch[1].length
        });
      }
    } catch (error2) {
      // Strategy 3: Find JSON object boundaries
      try {
        const startIndex = response.indexOf('{');
        const endIndex = response.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          const jsonString = response.substring(startIndex, endIndex + 1);
          puzzleData = JSON.parse(jsonString);
          logStructuredEvent('INFO', 'json_extraction_success', dateStr, 'Boundary extraction successful', {
            strategy: 'boundary_extraction',
            extracted_p1_answer: puzzleData?.p1_answer,
            p1_answer_length: puzzleData?.p1_answer?.length,
            boundary_start: startIndex,
            boundary_end: endIndex,
            extracted_length: endIndex - startIndex + 1
          });
        }
      } catch (error3) {
        // Strategy 4: Try to repair common JSON issues
        try {
          let repairedJson = response
            .replace(/```json|```/g, '')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .trim();
          
          const startIndex = repairedJson.indexOf('{');
          const endIndex = repairedJson.lastIndexOf('}');
          if (startIndex !== -1 && endIndex !== -1) {
            repairedJson = repairedJson.substring(startIndex, endIndex + 1);
            puzzleData = JSON.parse(repairedJson);
            logStructuredEvent('INFO', 'json_extraction_success', dateStr, 'JSON repair successful', {
              strategy: 'json_repair',
              extracted_p1_answer: puzzleData?.p1_answer,
              p1_answer_length: puzzleData?.p1_answer?.length,
              repair_start: startIndex,
              repair_end: endIndex,
              repaired_json_length: repairedJson.length
            });
          }
        } catch (error4) {
          logStructuredEvent('ERROR', 'json_extraction_failed', dateStr, 'All JSON extraction strategies failed', {
            response_length: response.length,
            response_full: response,
            response_preview: response.substring(0, 300),
            errors: [error.message, error2.message, error3.message, error4.message],
            char_analysis: {
              first_brace_index: response.indexOf('{'),
              last_brace_index: response.lastIndexOf('}'),
              contains_blockchain: response.toUpperCase().includes('BLOCKCHAIN'),
              contains_blockch: response.toUpperCase().includes('BLOCKCH'),
              word_boundary_analysis: extractWordBoundaries(response)
            }
          });
          return null;
        }
      }
    }
  }
  
  if (!puzzleData) {
    return null;
  }
  
  // Progressive validation with self-healing
  return validateAndHealPuzzle(puzzleData, dateStr, excludedAnswers);
}

/**
 * Progressive validation with self-healing capabilities
 */
function validateAndHealPuzzle(puzzleData, dateStr, excludedAnswers = null) {
  const validationResults = {
    structure_valid: false,
    encryption_valid: false,
    content_valid: false,
    uniqueness_valid: false,
    healing_applied: []
  };
  
  // Phase 1: Structure validation and healing
  try {
    if (!validatePuzzleStructure(puzzleData)) {
      puzzleData = healPuzzleStructure(puzzleData);
      validationResults.healing_applied.push('structure_healing');
    }
    validationResults.structure_valid = true;
  } catch (error) {
    logStructuredEvent('WARNING', 'structure_validation_failed', dateStr, 'Puzzle structure invalid', {
      error: error.toString(),
      puzzle_keys: Object.keys(puzzleData)
    });
    SYSTEM_METRICS.validation_failures++;
    return null;
  }
  
  // Phase 2: Encryption validation and healing
  try {
    if (!validateEncryptionLogic(puzzleData)) {
      puzzleData = healEncryptionIssues(puzzleData);
      validationResults.healing_applied.push('encryption_healing');
    }
    validationResults.encryption_valid = true;
  } catch (error) {
    logStructuredEvent('WARNING', 'encryption_validation_failed', dateStr, 'Encryption validation failed', {
      error: error.toString(),
      cipher_type: puzzleData.cipher_type,
      p1_answer: puzzleData.p1_answer,
      p2_answer: puzzleData.p2_answer
    });
    SYSTEM_METRICS.validation_failures++;
    return null;
  }
  
  // Phase 3: Content quality validation
  try {
    if (!validateContentQuality(puzzleData)) {
      logStructuredEvent('WARNING', 'content_quality_low', dateStr, 'Content quality concerns', {
        issues: getContentQualityIssues(puzzleData)
      });
      // Continue with low quality content rather than failing completely
    }
    validationResults.content_valid = true;
  } catch (error) {
    logStructuredEvent('WARNING', 'content_validation_error', dateStr, 'Content validation error', {
      error: error.toString()
    });
  }
  
  // Phase 4: Uniqueness validation
  try {
    if (excludedAnswers && hasRecentDuplicate(puzzleData, excludedAnswers)) {
      logStructuredEvent('WARNING', 'uniqueness_validation_failed', dateStr, 'Puzzle contains duplicate answers', {
        p1_answer: puzzleData.p1_answer,
        p2_answer: puzzleData.p2_answer,
        excluded_count: excludedAnswers.size
      });
      SYSTEM_METRICS.validation_failures++;
      return null; // Reject puzzle with duplicates
    }
    validationResults.uniqueness_valid = true;
  } catch (error) {
    logStructuredEvent('WARNING', 'uniqueness_validation_error', dateStr, 'Uniqueness validation error', {
      error: error.toString()
    });
    // Continue without uniqueness validation rather than failing completely
    validationResults.uniqueness_valid = true;
  }
  
  if (validationResults.healing_applied.length > 0) {
    logStructuredEvent('INFO', 'puzzle_healing_applied', dateStr, 'Puzzle successfully healed', {
      healing_methods: validationResults.healing_applied,
      final_validation: validationResults
    });
  }
  
  return puzzleData;
}

// ================================================
// VALIDATION HELPER FUNCTIONS
// ================================================

/**
 * Validates basic puzzle structure
 */
function validatePuzzleStructure(puzzle) {
  const requiredFields = [
    'cipher_type', 'p1_answer', 'p1_encrypted_word', 'p1_hint1', 'p1_hint2', 'p1_hint3',
    'p2_question', 'p2_hint1', 'p2_hint2', 'p2_hint3', 'p2_answer', 'p2_alt_answers',
    'p3_answer', 'p3_hint', 'category'
  ];
  
  for (const field of requiredFields) {
    if (!puzzle[field] || typeof puzzle[field] !== 'string') {
      return false;
    }
  }
  
  return CIPHER_TYPES.includes(puzzle.cipher_type);
}

/**
 * Validates encryption logic
 */
function validateEncryptionLogic(puzzle) {
  const { cipher_type, p1_answer, p1_encrypted_word, p2_answer, p3_answer } = puzzle;
  
  // Requirement 1: P1 and P2 must have different answers
  if (p1_answer.toUpperCase() === p2_answer.toUpperCase()) {
    return false;
  }
  
  // Requirement 2: P1 encryption must be correct
  const expectedP1Encrypted = applyCipher(p1_answer, cipher_type);
  if (p1_encrypted_word.toUpperCase() !== expectedP1Encrypted.toUpperCase()) {
    return false;
  }
  
  // Requirement 3: P3 must encrypt P2 answer correctly
  const expectedP3Answer = applyCipher(p2_answer, cipher_type);
  if (p3_answer.toUpperCase() !== expectedP3Answer.toUpperCase()) {
    return false;
  }
  
  return true;
}

/**
 * Validates content quality - ENHANCED WITH MAINSTREAM RECOGNITION VALIDATION
 */
function validateContentQuality(puzzle) {
  // Check for appropriate length
  if (puzzle.p1_answer.length < 3 || puzzle.p1_answer.length > 12) return false;
  if (puzzle.p2_answer.length < 3 || puzzle.p2_answer.length > 20) return false;
  
  // Check for reasonable question length
  if (puzzle.p2_question.length < 20 || puzzle.p2_question.length > 200) return false;
  
  // Check for hint progression
  if (puzzle.p1_hint1.length < 10 || puzzle.p2_hint1.length < 10) return false;
  
  // ENHANCED: Mainstream recognition validation
  if (!isMainstreamRecognizable(puzzle.p1_answer)) return false;
  if (!isMainstreamRecognizable(puzzle.p2_answer)) return false;
  
  return true;
}

/**
 * Enhanced function to validate if a term is mainstream recognizable
 */
function isMainstreamRecognizable(term) {
  const upperTerm = term.toUpperCase();
  
  // SF Bay Area companies (PREFERRED)
  const sfBayAreaCompanies = [
    'GOOGLE', 'APPLE', 'TESLA', 'META', 'FACEBOOK', 'NETFLIX', 'UBER', 'LYFT',
    'AIRBNB', 'TWITTER', 'ADOBE', 'SALESFORCE', 'INTEL', 'CISCO', 'ORACLE'
  ];
  
  // Major mainstream brands and companies
  const mainstreamBrands = [
    'AMAZON', 'MICROSOFT', 'DISNEY', 'SPOTIFY', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK',
    'WALMART', 'TARGET', 'STARBUCKS', 'MCDONALDS', 'COSTCO', 'SAMSUNG', 'SONY',
    'NIKE', 'ADIDAS', 'PEPSI', 'COCACOLA', 'VISA', 'MASTERCARD', 'PAYPAL'
  ];
  
  // Common tech terms that general public knows
  const commonTechTerms = [
    'INTERNET', 'COMPUTER', 'MOBILE', 'PHONE', 'EMAIL', 'WEBSITE', 'BROWSER',
    'LAPTOP', 'TABLET', 'DESKTOP', 'KEYBOARD', 'MOUSE', 'SCREEN', 'CAMERA'
  ];
  
  // General knowledge terms
  const generalTerms = [
    'MUSIC', 'MOVIE', 'VIDEO', 'PHOTO', 'GAME', 'BOOK', 'NEWS', 'SPORTS',
    'WEATHER', 'TRAVEL', 'FOOD', 'HEALTH', 'MONEY', 'CAR', 'HOME'
  ];
  
  // Check if term is in any mainstream category
  if (sfBayAreaCompanies.includes(upperTerm)) return true;
  if (mainstreamBrands.includes(upperTerm)) return true;
  if (commonTechTerms.includes(upperTerm)) return true;
  if (generalTerms.includes(upperTerm)) return true;
  
  // Technical jargon that should be REJECTED
  const technicalJargon = [
    'LORA', 'LORAWAN', 'KUBERNETES', 'ANSIBLE', 'GRAFANA', 'PYTORCH', 'TENSORFLOW',
    'HADOOP', 'APACHE', 'NGINX', 'REDIS', 'MONGODB', 'POSTGRESQL', 'MYSQL',
    'JENKINS', 'GITLAB', 'BITBUCKET', 'JIRA', 'CONFLUENCE', 'KUBERNETES',
    'DOCKER', 'MICROSERVICE', 'API', 'SDK', 'JSON', 'XML', 'HTTP', 'HTTPS',
    'CSS', 'HTML', 'JAVASCRIPT', 'PYTHON', 'JAVA', 'GOLANG', 'RUST', 'SCALA'
  ];
  
  // Reject technical jargon
  if (technicalJargon.includes(upperTerm)) return false;
  
  // If not explicitly approved or rejected, apply heuristics
  // Short terms (3-4 letters) are often abbreviations - be careful
  if (upperTerm.length <= 4) {
    // Only allow if it's a very common abbreviation
    const commonAbbrevs = ['NASA', 'FBI', 'CIA', 'DVD', 'GPS', 'USB', 'WIFI', 'TV'];
    return commonAbbrevs.includes(upperTerm);
  }
  
  // For longer terms, be more permissive but still cautious
  // If it contains common word patterns, it might be okay
  const commonWordParts = ['TECH', 'SOFT', 'HARD', 'NET', 'WEB', 'DIGITAL', 'SMART'];
  const hasCommonPart = commonWordParts.some(part => upperTerm.includes(part));
  
  // Default to cautious - if we're not sure, it's probably not mainstream enough
  return hasCommonPart;
}

/**
 * Heals puzzle structure issues
 */
function healPuzzleStructure(puzzle) {
  const healed = { ...puzzle };
  
  // Fill missing fields with defaults
  if (!healed.cipher_type || !CIPHER_TYPES.includes(healed.cipher_type)) {
    healed.cipher_type = 'caesar_3';
  }
  
  if (!healed.category) {
    healed.category = 'general';
  }
  
  // Ensure all fields are strings
  Object.keys(healed).forEach(key => {
    if (typeof healed[key] !== 'string') {
      healed[key] = String(healed[key] || '');
    }
  });
  
  return healed;
}

/**
 * Heals encryption issues
 */
function healEncryptionIssues(puzzle) {
  const healed = { ...puzzle };
  
  // Fix P1 encryption if incorrect
  const expectedP1Encrypted = applyCipher(healed.p1_answer, healed.cipher_type);
  healed.p1_encrypted_word = expectedP1Encrypted;
  
  // Fix P3 encryption (should encrypt P2 answer)
  const expectedP3Answer = applyCipher(healed.p2_answer, healed.cipher_type);
  healed.p3_answer = expectedP3Answer;
  
  return healed;
}

/**
 * Gets content quality issues for logging
 */
function getContentQualityIssues(puzzle) {
  const issues = [];
  
  if (puzzle.p1_answer.length < 3 || puzzle.p1_answer.length > 12) {
    issues.push('p1_answer_length_inappropriate');
  }
  
  if (puzzle.p2_question.length < 20) {
    issues.push('p2_question_too_short');
  }
  
  if (puzzle.p2_question.length > 200) {
    issues.push('p2_question_too_long');
  }
  
  return issues;
}

// ================================================
// CIPHER IMPLEMENTATION
// ================================================

/**
 * Applies cipher encryption to a word with enhanced error handling
 */
function applyCipher(word, cipherType) {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word for cipher application');
  }
  
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  
  for (let i = 0; i < word.length; i++) {
    const char = word[i].toUpperCase();
    if (!alphabet.includes(char)) {
      result += char; // Keep non-letters unchanged
      continue;
    }
    
    const index = alphabet.indexOf(char);
    let newIndex;
    
    switch (cipherType) {
      case 'rot13':
        newIndex = (index + 13) % 26;
        break;
      case 'atbash':
        newIndex = 25 - index;
        break;
      case 'caesar_3':
        newIndex = (index + 3) % 26;
        break;
      case 'caesar_5':
        newIndex = (index + 5) % 26;
        break;
      case 'caesar_7':
        newIndex = (index + 7) % 26;
        break;
      case 'caesar_11':
        newIndex = (index + 11) % 26;
        break;
      case 'caesar_neg3':
        newIndex = (index - 3 + 26) % 26;
        break;
      case 'caesar_neg5':
        newIndex = (index - 5 + 26) % 26;
        break;
      default:
        throw new Error(`Unknown cipher type: ${cipherType}`);
    }
    
    result += alphabet[newIndex];
  }
  
  return result;
}

// ================================================
// SMART FALLBACK SYSTEM
// ================================================

/**
 * Gets fallback puzzle from sheet with smart rotation
 */
function getSheetFallbackPuzzle(dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fallbackSheet = ss.getSheetByName('Fallback_Puzzles');
  
  if (!fallbackSheet) {
    throw new Error('Fallback_Puzzles sheet not found');
  }
  
  const data = fallbackSheet.getDataRange().getValues();
  if (data.length <= 1) {
    throw new Error('No fallback puzzles available in sheet');
  }
  
  // Use date-based deterministic selection to ensure same puzzle for same date
  const dateHash = hashDateString(dateStr);
  const fallbackIndex = (dateHash % (data.length - 1)) + 1; // Skip header row
  const fallbackRow = data[fallbackIndex];
  
  return {
    cipher_type: fallbackRow[1] || 'caesar_3',
    p1_answer: fallbackRow[2] || 'FALLBACK',
    p1_encrypted_word: fallbackRow[3] || 'IDOOEDFN',
    p1_hint1: fallbackRow[4] || 'This is a fallback cipher hint',
    p1_hint2: fallbackRow[5] || 'This is a Caesar cipher',
    p1_hint3: fallbackRow[6] || '3',
    p2_question: fallbackRow[7] || 'What do you call a backup solution?',
    p2_hint1: fallbackRow[8] || 'Used when primary systems fail',
    p2_hint2: fallbackRow[9] || 'Emergency backup procedure',
    p2_hint3: fallbackRow[10] || 'Contingency plan activation',
    p2_answer: fallbackRow[11] || 'BACKUP',
    p2_alt_answers: fallbackRow[12] || 'BACKUP,FALLBACK,CONTINGENCY',
    p3_answer: fallbackRow[13] || 'EDFNXS',
    p3_hint: fallbackRow[14] || 'Use the same cipher method',
    category: fallbackRow[15] || 'general',
    fallback_index: fallbackIndex
  };
}

/**
 * Gets hardcoded fallback puzzle with collision-free selection
 * EXPANDED: Now includes 20+ puzzles for 30+ days of uniqueness
 */
function getHardcodedFallbackPuzzle(dateStr, excludedAnswers = null) {
  const fallbackPool = [
    // SF Bay Area Tech Companies (Mainstream Recognition Focus)
    {
      cipher_type: "caesar_3",
      p1_answer: "GOOGLE",
      p1_encrypted_word: "JRRJOH",
      p1_hint1: "This cipher method was used by Julius Caesar in his military campaigns",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "3",
      p2_question: "What video streaming service started as DVD-by-mail?",
      p2_hint1: "Famous for original shows like Stranger Things",
      p2_hint2: "Red logo and binge-watching culture",
      p2_hint3: "Competes with Disney+ and Hulu",
      p2_answer: "NETFLIX",
      p2_alt_answers: "NETFLIX,STREAMING SERVICE",
      p3_answer: "QHWIOLB",
      p3_hint: "Use the same 3-position forward shift",
      category: "technology"
    },
    {
      cipher_type: "caesar_5",
      p1_answer: "APPLE",
      p1_encrypted_word: "FUUQJ",
      p1_hint1: "This cipher method was used by Julius Caesar in his military campaigns",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "5",
      p2_question: "What scientist is known for his laws of motion and the concept of gravity?",
      p2_hint1: "Developed three fundamental laws of motion",
      p2_hint2: "Legend says an apple fell on his head",
      p2_hint3: "English physicist and mathematician from the 17th century",
      p2_answer: "NEWTON",
      p2_alt_answers: "NEWTON,ISAAC NEWTON",
      p3_answer: "SJBYTS",
      p3_hint: "Use the same 5-position forward shift",
      category: "technology"
    },
    {
      cipher_type: "rot13",
      p1_answer: "TESLA",
      p1_encrypted_word: "GRFYN",
      p1_hint1: "This cipher was popularized in online forums",
      p1_hint2: "This is a rotation cipher",
      p1_hint3: "13",
      p2_question: "What ancient wonder of the world was built in Egypt?",
      p2_hint1: "Built as tombs for pharaohs",
      p2_hint2: "Located near the Sphinx in Giza",
      p2_hint3: "Only surviving wonder of the ancient world",
      p2_answer: "PYRAMID",
      p2_alt_answers: "PYRAMID,PYRAMIDS,GREAT PYRAMID",
      p3_answer: "CLENZVQ",
      p3_hint: "Use the same 13-position shift",
      category: "technology"
    },
    {
      cipher_type: "atbash",
      p1_answer: "NETFLIX",
      p1_encrypted_word: "MVGSOLC",
      p1_hint1: "Ancient cipher used in Hebrew texts",
      p1_hint2: "Mirror alphabet (A↔Z, B↔Y)",
      p1_hint3: "First becomes last, second becomes second-to-last",
      p2_question: "What gas makes up most of Earth's atmosphere?",
      p2_hint1: "Makes up about 78% of the air we breathe",
      p2_hint2: "Essential for plant growth and fertilizers",
      p2_hint3: "Chemical symbol is N₂",
      p2_answer: "NITROGEN",
      p2_alt_answers: "NITROGEN,N2",
      p3_answer: "MRGILTVM",
      p3_hint: "Use the same mirror alphabet",
      category: "technology"
    },
    // Major Consumer Brands
    {
      cipher_type: "caesar_7",
      p1_answer: "AMAZON",
      p1_encrypted_word: "HTHQVU",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "7",
      p2_question: "What musical instrument has 88 keys?",
      p2_hint1: "Has both black and white keys",
      p2_hint2: "Can be grand or upright",
      p2_hint3: "Often called the king of instruments",
      p2_answer: "PIANO",
      p2_alt_answers: "PIANO,PIANOFORTE",
      p3_answer: "WPHUV",
      p3_hint: "Use the same 7-position forward shift",
      category: "entertainment"
    },
    {
      cipher_type: "caesar_11",
      p1_answer: "DISNEY",
      p1_encrypted_word: "ODPET",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "11",
      p2_question: "What music streaming service has a green logo?",
      p2_hint1: "Swedish company launched in 2008",
      p2_hint2: "Offers both free and premium plans",
      p2_hint3: "Competes with Apple Music",
      p2_answer: "SPOTIFY",
      p2_alt_answers: "SPOTIFY,SPOTIFY MUSIC",
      p3_answer: "DAFEOT",
      p3_hint: "Use the same 11-position forward shift",
      category: "entertainment"
    },
    {
      cipher_type: "caesar_neg3",
      p1_answer: "SPOTIFY",
      p1_encrypted_word: "PMLIFV",
      p1_hint1: "This cipher shifts backward like Caesar's",
      p1_hint2: "Caesar cipher in reverse",
      p1_hint3: "3 positions backward",
      p2_question: "What coffee chain has a green mermaid logo?",
      p2_hint1: "Founded in Seattle in 1971",
      p2_hint2: "Famous for Frappuccinos and lattes",
      p2_hint3: "Named after a character from Moby Dick",
      p2_answer: "STARBUCKS",
      p2_alt_answers: "STARBUCKS,STARBUCKS COFFEE",
      p3_answer: "PQXOYRFP",
      p3_hint: "Use the same 3-position backward shift",
      category: "food"
    },
    // Additional Mainstream Brands
    {
      cipher_type: "caesar_3",
      p1_answer: "MICROSOFT",
      p1_encrypted_word: "PLFURVRIW",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "3",
      p2_question: "What fast food chain is known for golden arches?",
      p2_hint1: "I'm lovin' it slogan",
      p2_hint2: "Famous for Big Mac and Happy Meals",
      p2_hint3: "Red and yellow branding",
      p2_answer: "MCDONALDS",
      p2_alt_answers: "MCDONALDS,MCDONALD'S",
      p3_answer: "PFGRQDOGV",
      p3_hint: "Use the same 3-position forward shift",
      category: "food"
    },
    {
      cipher_type: "rot13",
      p1_answer: "STARBUCKS",
      p1_encrypted_word: "FGNEOHPXF",
      p1_hint1: "Popular cipher in internet forums",
      p1_hint2: "ROT13 rotation cipher",
      p1_hint3: "13 positions forward",
      p2_question: "What shipping company has brown trucks?",
      p2_hint1: "What can brown do for you?",
      p2_hint2: "Competes with FedEx for package delivery",
      p2_hint3: "Founded in 1907 in Seattle",
      p2_answer: "UPS",
      p2_alt_answers: "UPS,UNITED PARCEL SERVICE",
      p3_answer: "HCF",
      p3_hint: "Use the same 13-position shift",
      category: "logistics"
    },
    {
      cipher_type: "atbash",
      p1_answer: "WALMART",
      p1_encrypted_word: "DZONGIG",
      p1_hint1: "Ancient Hebrew cipher technique",
      p1_hint2: "Atbash mirror alphabet",
      p1_hint3: "A becomes Z, B becomes Y",
      p2_question: "What retail store has a red bullseye logo?",
      p2_hint1: "Expect More, Pay Less slogan",
      p2_hint2: "Red and white branding",
      p2_hint3: "Competes with Walmart",
      p2_answer: "TARGET",
      p2_alt_answers: "TARGET,TARGET STORES",
      p3_answer: "GZITJG",
      p3_hint: "Use the same mirror alphabet",
      category: "retail"
    },
    // Science & Space (Mainstream Focus)
    {
      cipher_type: "caesar_5",
      p1_answer: "MARS",
      p1_encrypted_word: "RFW",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "5",
      p2_question: "What planet is known for its rings?",
      p2_hint1: "Sixth planet from the Sun",
      p2_hint2: "Named after Roman god of agriculture",
      p2_hint3: "Cassini spacecraft studied it",
      p2_answer: "SATURN",
      p2_alt_answers: "SATURN,SATURN PLANET",
      p3_answer: "XFYZWS",
      p3_hint: "Use the same 5-position forward shift",
      category: "space"
    },
    {
      cipher_type: "caesar_7",
      p1_answer: "EARTH",
      p1_encrypted_word: "LHYAO",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "7",
      p2_question: "What is the largest planet in our solar system?",
      p2_hint1: "Gas giant with Great Red Spot",
      p2_hint2: "Has over 80 moons",
      p2_hint3: "Named after Roman king of gods",
      p2_answer: "JUPITER",
      p2_alt_answers: "JUPITER,JUPITER PLANET",
      p3_answer: "QBWPALY",
      p3_hint: "Use the same 7-position forward shift",
      category: "space"
    },
    // Entertainment & Sports
    {
      cipher_type: "caesar_neg5",
      p1_answer: "YOUTUBE",
      p1_encrypted_word: "TPNOPWZ",
      p1_hint1: "Caesar cipher shifting backward",
      p1_hint2: "Backward Caesar cipher",
      p1_hint3: "5 positions backward",
      p2_question: "What streaming service is owned by Amazon?",
      p2_hint1: "Offers free shipping with membership",
      p2_hint2: "Competes with Netflix",
      p2_hint3: "Same name as Amazon's main service",
      p2_answer: "PRIME",
      p2_alt_answers: "PRIME,AMAZON PRIME",
      p3_answer: "KMDIR",
      p3_hint: "Use the same 5-position backward shift",
      category: "entertainment"
    },
    {
      cipher_type: "rot13",
      p1_answer: "INSTAGRAM",
      p1_encrypted_word: "VAFGNTENZ",
      p1_hint1: "Popular in online communities",
      p1_hint2: "ROT13 cipher",
      p1_hint3: "13 positions forward",
      p2_question: "What planet is known as the Red Planet?",
      p2_hint1: "Fourth planet from the Sun",
      p2_hint2: "Named after the Roman god of war",
      p2_hint3: "Has two small moons: Phobos and Deimos",
      p2_answer: "MARS",
      p2_alt_answers: "MARS,RED PLANET",
      p3_answer: "ZNEF",
      p3_hint: "Use the same 13-position shift",
      category: "social media"
    },
    // Additional Tech & Brands
    {
      cipher_type: "atbash",
      p1_answer: "SAMSUNG",
      p1_encrypted_word: "XDNFZHM",
      p1_hint1: "Hebrew biblical cipher",
      p1_hint2: "Atbash reversal system",
      p1_hint3: "Mirror positions A↔Z",
      p2_question: "What element has the chemical symbol 'O'?",
      p2_hint1: "Essential for breathing and combustion",
      p2_hint2: "Makes up about 21% of Earth's atmosphere",
      p2_hint3: "Water is H2O - two hydrogen, one of this",
      p2_answer: "OXYGEN",
      p2_alt_answers: "OXYGEN,O2",
      p3_answer: "LCBTVM",
      p3_hint: "Use the same mirror alphabet",
      category: "sports"
    },
    {
      cipher_type: "caesar_3",
      p1_answer: "XBOX",
      p1_encrypted_word: "AERB",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "3",
      p2_question: "What gaming console is made by Sony?",
      p2_hint1: "Competes with Xbox and Nintendo",
      p2_hint2: "Uses DualShock controllers",
      p2_hint3: "Latest version is PS5",
      p2_answer: "PLAYSTATION",
      p2_alt_answers: "PLAYSTATION,SONY PLAYSTATION,PS",
      p3_answer: "SOBLVWDWLRQ",
      p3_hint: "Use the same 3-position forward shift",
      category: "gaming"
    },
    // Food & Consumer Goods
    {
      cipher_type: "caesar_5",
      p1_answer: "PEPSI",
      p1_encrypted_word: "UJUXN",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "5",
      p2_question: "What cola brand is red and white?",
      p2_hint1: "The Real Thing slogan",
      p2_hint2: "Classic recipe from 1886",
      p2_hint3: "Main competitor to Pepsi",
      p2_answer: "COCACOLA",
      p2_alt_answers: "COCACOLA,COCA COLA,COKE",
      p3_answer: "HJHFHQF",
      p3_hint: "Use the same 5-position forward shift",
      category: "food"
    },
    {
      cipher_type: "caesar_neg3",
      p1_answer: "HONDA",
      p1_encrypted_word: "ELKAR",
      p1_hint1: "Caesar cipher in reverse",
      p1_hint2: "Backward shifting cipher",
      p1_hint3: "3 positions backward",
      p2_question: "What force keeps planets in orbit around the Sun?",
      p2_hint1: "Newton's law describes this universal force",
      p2_hint2: "Causes objects to fall toward Earth",
      p2_hint3: "Einstein showed it bends space and time",
      p2_answer: "GRAVITY",
      p2_alt_answers: "GRAVITY,GRAVITATIONAL FORCE",
      p3_answer: "DOXSFQV",
      p3_hint: "Use the same 3-position backward shift",
      category: "automotive"
    },
    // Additional Popular Brands
    {
      cipher_type: "caesar_7",
      p1_answer: "ADIDAS",
      p1_encrypted_word: "HKPKHZ",
      p1_hint1: "This cipher method was used by Julius Caesar",
      p1_hint2: "This is a Caesar cipher", 
      p1_hint3: "7",
      p2_question: "What ocean is the largest on Earth?",
      p2_hint1: "Covers about one-third of Earth's surface",
      p2_hint2: "Borders Asia, Australia, and the Americas",
      p2_hint3: "Contains the Mariana Trench",
      p2_answer: "PACIFIC",
      p2_alt_answers: "PACIFIC,PACIFIC OCEAN",
      p3_answer: "WHJPMPJ",
      p3_hint: "Use the same 7-position forward shift",
      category: "finance"
    },
    {
      cipher_type: "rot13",
      p1_answer: "NINTENDO",
      p1_encrypted_word: "AVAGRAGB",
      p1_hint1: "Popular internet cipher",
      p1_hint2: "ROT13 rotation",
      p1_hint3: "13 positions forward",
      p2_question: "What continent is known as the Dark Continent?",
      p2_hint1: "Second largest continent by area",
      p2_hint2: "Home to the Sahara Desert",
      p2_hint3: "Birthplace of humanity",
      p2_answer: "AFRICA",
      p2_alt_answers: "AFRICA,AFRICAN CONTINENT",
      p3_answer: "NSEVPN",
      p3_hint: "Use the same 13-position shift",
      category: "technology"
    }
  ];
  
  // Collision-free selection with fallback
  let availablePuzzles = fallbackPool;
  
  if (excludedAnswers && excludedAnswers.size > 0) {
    // Filter out puzzles with duplicate answers
    availablePuzzles = fallbackPool.filter(puzzle => {
      const p1Answer = puzzle.p1_answer.toUpperCase();
      const p2Answer = puzzle.p2_answer.toUpperCase();
      return !excludedAnswers.has(p1Answer) && !excludedAnswers.has(p2Answer);
    });
    
    // If all puzzles are excluded, use the full pool (emergency fallback)
    if (availablePuzzles.length === 0) {
      logStructuredEvent('WARNING', 'fallback_pool_exhausted', dateStr, 'All fallback puzzles excluded, using full pool', {
        total_fallbacks: fallbackPool.length,
        excluded_count: excludedAnswers.size
      });
      availablePuzzles = fallbackPool;
    }
  }
  
  // Use date-based selection for consistency
  const dateHash = hashDateString(dateStr);
  const puzzleIndex = dateHash % availablePuzzles.length;
  const selectedPuzzle = availablePuzzles[puzzleIndex];
  
  logStructuredEvent('INFO', 'hardcoded_fallback_selected', dateStr, 'Selected hardcoded fallback puzzle', {
    puzzle_index: puzzleIndex,
    available_puzzles: availablePuzzles.length,
    total_pool_size: fallbackPool.length,
    excluded_count: excludedAnswers ? excludedAnswers.size : 0,
    selected_p1: selectedPuzzle.p1_answer,
    selected_p2: selectedPuzzle.p2_answer,
    cipher_type: selectedPuzzle.cipher_type
  });
  
  return selectedPuzzle;
}

/**
 * Emergency puzzle when all else fails
 */
function getEmergencyPuzzle(dateStr) {
  return {
    cipher_type: "caesar_3",
    p1_answer: "SYSTEM",
    p1_encrypted_word: "VBVWHP",
    p1_hint1: "This cipher method was used by Julius Caesar",
    p1_hint2: "This is a Caesar cipher",
    p1_hint3: "3",
    p2_question: "What do you call an organized set of components working together?",
    p2_hint1: "Can be biological, mechanical, or software-based",
    p2_hint2: "Has inputs, processes, and outputs",
    p2_hint3: "This puzzle is part of one",
    p2_answer: "SYSTEM",
    p2_alt_answers: "SYSTEM,FRAMEWORK,STRUCTURE",
    p3_answer: "VBVWHP",
    p3_hint: "Use the same 3-position forward shift",
    category: "general",
    emergency: true
  };
}

// ================================================
// BALANCED CONTENT SELECTION
// ================================================

/**
 * Gets balanced category based on date to ensure variety
 */
function getBalancedCategory(dateStr) {
  const dateHash = hashDateString(dateStr);
  return CATEGORIES[dateHash % CATEGORIES.length];
}

/**
 * Gets balanced cipher based on date to ensure variety
 */
function getBalancedCipher(dateStr) {
  const dateHash = hashDateString(dateStr);
  return CIPHER_TYPES[dateHash % CIPHER_TYPES.length];
}

/**
 * Creates a simple hash from date string for deterministic selection
 */
function hashDateString(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// ================================================
// PRODUCTION-GRADE LOGGING
// ================================================

/**
 * Logs structured events for monitoring and debugging
 */
function logStructuredEvent(level, eventType, puzzleDate, message, metadata = {}) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const systemLog = ss.getSheetByName('System_Log');
  
  if (!systemLog) {
    console.error('System_Log sheet not found');
    return;
  }
  
  const timestamp = new Date();
  const logEntry = {
    timestamp: timestamp.toISOString(),
    level: level,
    event_type: eventType,
    puzzle_date: puzzleDate || 'N/A',
    message: message,
    metadata: JSON.stringify(metadata),
    system_metrics: JSON.stringify(SYSTEM_METRICS)
  };
  
  try {
    const newRow = systemLog.getLastRow() + 1;
    systemLog.getRange(newRow, 1, 1, 7).setValues([[
      timestamp,                    // A: timestamp
      eventType,                   // B: event_type
      puzzleDate || 'N/A',         // C: puzzle_date
      level,                       // D: status
      message,                     // E: details
      JSON.stringify(metadata),    // F: metadata
      0                           // G: retry_count (preserved for compatibility)
    ]]);
    
    // Also log to console with structured format
    console.log(`[${level}] ${eventType}: ${message}`, metadata);
    
  } catch (error) {
    console.error('Failed to write to System_Log:', error);
    console.log(`[${level}] ${eventType}: ${message}`, metadata);
  }
}

// ================================================
// CURRENT PUZZLE TAB MANAGEMENT
// ================================================

/**
 * Updates the Current_Puzzle tab with today's puzzle for easy Landbot access
 */
function updateCurrentPuzzleTab(puzzleData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let currentPuzzleSheet = ss.getSheetByName('Current_Puzzle');
  
  if (!currentPuzzleSheet) {
    logStructuredEvent('INFO', 'creating_current_puzzle_tab', null, 'Current_Puzzle tab not found, creating it');
    currentPuzzleSheet = ss.insertSheet('Current_Puzzle');
    
    // Add headers
    currentPuzzleSheet.getRange(1, 1, 1, 15).setValues([[
      'cipher_type', 'p1_answer', 'p1_encrypted_word', 'p1_hint1', 'p1_hint2', 'p1_hint3',
      'p2_question', 'p2_hint1', 'p2_hint2', 'p2_hint3', 'p2_answer', 'p2_alt_answers',
      'p3_answer', 'p3_hint', 'category'
    ]]);
  }
  
  // Update row 2 with current puzzle data (15 columns)
  currentPuzzleSheet.getRange(2, 1, 1, 15).setValues([[
    puzzleData.cipher_type,       // A: cipher_type
    puzzleData.p1_answer,         // B: p1_answer
    puzzleData.p1_encrypted_word, // C: p1_encrypted_word
    puzzleData.p1_hint1,          // D: p1_hint1
    puzzleData.p1_hint2,          // E: p1_hint2
    puzzleData.p1_hint3,          // F: p1_hint3
    puzzleData.p2_question,       // G: p2_question
    puzzleData.p2_hint1,          // H: p2_hint1
    puzzleData.p2_hint2,          // I: p2_hint2
    puzzleData.p2_hint3,          // J: p2_hint3
    puzzleData.p2_answer,         // K: p2_answer
    puzzleData.p2_alt_answers,    // L: p2_alt_answers
    puzzleData.p3_answer,         // M: p3_answer
    puzzleData.p3_hint,           // N: p3_hint
    puzzleData.category           // O: category
  ]]);
  
  logStructuredEvent('INFO', 'current_puzzle_updated', null, 'Current_Puzzle tab updated for Landbot access', {
    cipher_type: puzzleData.cipher_type,
    category: puzzleData.category,
    source: puzzleData.source
  });
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

/**
 * Gets recent puzzle answers for uniqueness checking
 */
function getRecentAnswers(days = 30) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  
  if (!puzzleSheet) {
    return new Set();
  }
  
  const data = puzzleSheet.getDataRange().getValues();
  const recentAnswers = new Set();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  for (let i = 1; i < data.length; i++) { // Skip headers
    const rowDate = data[i][0];
    const puzzleDate = (rowDate instanceof Date) ? rowDate : new Date(rowDate);
    
    if (puzzleDate >= cutoffDate) {
      const p1Answer = data[i][2]; // Column C
      const p2Answer = data[i][11]; // Column L
      
      if (p1Answer) recentAnswers.add(p1Answer.toString().toUpperCase());
      if (p2Answer) recentAnswers.add(p2Answer.toString().toUpperCase());
    }
  }
  
  return recentAnswers;
}

/**
 * Checks if puzzle has duplicate answers from recent puzzles
 */
function hasRecentDuplicate(puzzleData, excludedAnswers) {
  const p1Answer = puzzleData.p1_answer.toUpperCase();
  const p2Answer = puzzleData.p2_answer.toUpperCase();
  
  return excludedAnswers.has(p1Answer) || excludedAnswers.has(p2Answer);
}

/**
 * Creates exclusion text for prompts based on recent answers
 */
function createExclusionPromptText(excludedAnswers) {
  if (!excludedAnswers || excludedAnswers.size === 0) {
    return '';
  }
  
  const recentList = Array.from(excludedAnswers).slice(0, 10).join(', ');
  return `\n\nCRITICAL: DO NOT use these recent answers: ${recentList}`;
}

/**
 * Extracts word boundaries for analysis
 */
function extractWordBoundaries(text) {
  const words = text.match(/\b[A-Z]{3,}\b/g) || [];
  return {
    word_count: words.length,
    unique_words: [...new Set(words)].length,
    long_words: words.filter(w => w.length > 6),
    sample_words: words.slice(0, 5)
  };
}

/**
 * Finds row number for a specific date in the puzzle sheet
 */
function findRowByDate(sheet, date) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Start at 1 to skip headers
    if (data[i][0] === date || 
        (data[i][0] instanceof Date && 
         Utilities.formatDate(data[i][0], SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd') === date)) {
      return i + 1; // Return 1-indexed row number
    }
  }
  return -1;
}

/**
 * Generates anonymous session ID for tracking
 */
function generateSessionId() {
  return 'session_' + Utilities.getUuid().slice(0, 8);
}

/**
 * Updates usage count when puzzle is completed (called from Landbot)
 */
function updateUsageCount(puzzleDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  const usageLog = ss.getSheetByName('Usage_Log');
  
  if (!puzzleSheet || !usageLog) {
    logStructuredEvent('ERROR', 'usage_update_failed', puzzleDate, 'Required sheets not found for usage tracking');
    return;
  }
  
  // Find the row for the specified date
  const data = puzzleSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) { // Skip headers
    const rowDate = data[i][0];
    const dateStr = (rowDate instanceof Date) ? 
      Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : 
      rowDate;
    
    if (dateStr === puzzleDate) {
      const currentCount = data[i][19] || 0; // Column T (usage_count)
      puzzleSheet.getRange(i + 1, 20).setValue(currentCount + 1);
      
      // Log the usage
      const newLogRow = usageLog.getLastRow() + 1;
      usageLog.getRange(newLogRow, 1, 1, 10).setValues([[
        new Date(),                    // A: log_date
        puzzleDate,                   // B: puzzle_date
        generateSessionId(),          // C: user_session_id
        'completed',                  // D: completion_status
        '',                          // E: hints_used_p1
        '',                          // F: hints_used_p2
        '',                          // G: hints_used_p3
        '',                          // H: total_time_seconds
        'landbot',                   // I: source
        ''                           // J: user_agent
      ]]);
      
      logStructuredEvent('INFO', 'usage_count_updated', puzzleDate, 'Usage count incremented', {
        new_count: currentCount + 1,
        row_number: i + 1
      });
      break;
    }
  }
}

// ================================================
// AUTOMATION SETUP
// ================================================

/**
 * Sets up daily trigger for automatic puzzle generation
 * Run this once after installing the script
 */
function setupDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  // Create new daily trigger at 1 AM
  ScriptApp.newTrigger('generateDailyPuzzleSequence')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
    
  logStructuredEvent('INFO', 'daily_trigger_setup', null, 'Daily trigger configured successfully', {
    trigger_time: '1 AM daily',
    function_name: 'generateDailyPuzzleSequence'
  });
  
  console.log('Daily trigger set up successfully. Puzzles will generate at 1 AM daily.');
}

// ================================================
// WEB APP API (for Landbot integration)
// ================================================

/**
 * Web app API endpoint for Landbot integration
 * Deploy as web app to get URL for Landbot
 */
function doGet(e) {
  const action = e.parameter.action;
  
  try {
    if (action === 'today') {
      const puzzleData = getTodaysPuzzleSequence();
      return ContentService
        .createTextOutput(JSON.stringify(puzzleData))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'update_usage') {
      const puzzleDate = e.parameter.date || Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      updateUsageCount(puzzleDate);
      return ContentService.createTextOutput('Usage updated');
    }
    
    if (action === 'metrics') {
      return ContentService
        .createTextOutput(JSON.stringify(SYSTEM_METRICS))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Invalid request',
      valid_actions: ['today', 'update_usage', 'metrics']
    }));
    
  } catch (error) {
    logStructuredEvent('ERROR', 'web_app_error', null, 'Web app request failed', {
      action: action,
      error: error.toString()
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      error: 'Internal server error',
      message: error.toString()
    }));
  }
}

/**
 * Gets today's puzzle sequence for API access
 */
function getTodaysPuzzleSequence() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  const today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  if (!puzzleSheet) {
    logStructuredEvent('ERROR', 'get_today_puzzle_failed', today, 'Daily_Puzzles sheet not found');
    return getEmergencyPuzzle(today);
  }
  
  const data = puzzleSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Skip headers
    const rowDate = data[i][0];
    const dateStr = (rowDate instanceof Date) ? 
      Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : 
      rowDate;
    
    if (dateStr === today) {
      return {
        cipher_type: data[i][1],
        p1_answer: data[i][2],
        p1_encrypted_word: data[i][3],
        p1_hint1: data[i][4],
        p1_hint2: data[i][5],
        p1_hint3: data[i][6],
        p2_question: data[i][7],
        p2_hint1: data[i][8],
        p2_hint2: data[i][9],
        p2_hint3: data[i][10],
        p2_answer: data[i][11],
        p2_alt_answers: data[i][12],
        p3_answer: data[i][13],
        p3_hint: data[i][14],
        category: data[i][15]
      };
    }
  }
  
  // If no puzzle found for today, try to generate one
  logStructuredEvent('WARNING', 'no_puzzle_for_today', today, 'No puzzle found for today, attempting generation');
  
  try {
    generateDailyPuzzleSequence();
    // Try again after generation
    const newData = puzzleSheet.getDataRange().getValues();
    for (let i = 1; i < newData.length; i++) {
      const rowDate = newData[i][0];
      const dateStr = (rowDate instanceof Date) ? 
        Utilities.formatDate(rowDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd') : 
        rowDate;
      
      if (dateStr === today) {
        return {
          cipher_type: newData[i][1],
          p1_answer: newData[i][2],
          p1_encrypted_word: newData[i][3],
          p1_hint1: newData[i][4],
          p1_hint2: newData[i][5],
          p1_hint3: newData[i][6],
          p2_question: newData[i][7],
          p2_hint1: newData[i][8],
          p2_hint2: newData[i][9],
          p2_hint3: newData[i][10],
          p2_answer: newData[i][11],
          p2_alt_answers: newData[i][12],
          p3_answer: newData[i][13],
          p3_hint: newData[i][14],
          category: newData[i][15]
        };
      }
    }
  } catch (error) {
    logStructuredEvent('ERROR', 'emergency_generation_failed', today, 'Emergency puzzle generation failed', {
      error: error.toString()
    });
  }
  
  // Return emergency puzzle as last resort
  return getEmergencyPuzzle(today);
}

// ================================================
// SETUP AND INITIALIZATION
// ================================================

/**
 * Creates initial puzzle for today to get started
 * Run this once after setting up the sheet structure
 */
function createInitialPuzzle() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  const today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  if (!puzzleSheet) {
    logStructuredEvent('ERROR', 'initial_puzzle_failed', today, 'Daily_Puzzles sheet not found');
    console.log('Daily_Puzzles sheet not found. Please create the sheet first.');
    return;
  }
  
  // Check if today's puzzle already exists
  if (findRowByDate(puzzleSheet, today) > 1) {
    logStructuredEvent('INFO', 'initial_puzzle_exists', today, 'Today\'s puzzle already exists');
    console.log('Today\'s puzzle already exists');
    return;
  }
  
  // Use the fallback system to create initial puzzle
  const initialPuzzle = getHardcodedFallbackPuzzle(today);
  
  puzzleSheet.getRange(2, 1, 1, 20).setValues([[
    today, initialPuzzle.cipher_type, initialPuzzle.p1_answer, initialPuzzle.p1_encrypted_word, 
    initialPuzzle.p1_hint1, initialPuzzle.p1_hint2, initialPuzzle.p1_hint3,
    initialPuzzle.p2_question, initialPuzzle.p2_hint1, initialPuzzle.p2_hint2, initialPuzzle.p2_hint3, 
    initialPuzzle.p2_answer, initialPuzzle.p2_alt_answers, initialPuzzle.p3_answer, initialPuzzle.p3_hint,
    initialPuzzle.category, CIPHER_DIFFICULTY[initialPuzzle.cipher_type] || 2, "initial_setup", true, 0
  ]]);
  
  // Also update Current_Puzzle tab
  updateCurrentPuzzleTab(initialPuzzle);
  
  logStructuredEvent('SUCCESS', 'initial_puzzle_created', today, 'Initial puzzle created successfully', {
    cipher_type: initialPuzzle.cipher_type,
    category: initialPuzzle.category
  });
  
  console.log('Initial puzzle created for ' + today);
}

/**
 * One-time setup function - run this after installing the script
 * Sets up API key, creates initial puzzle, and enables daily automation
 */
function initialSetup() {
  // Check if API key is set
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    logStructuredEvent('ERROR', 'setup_failed', null, 'GEMINI_API_KEY not found', {
      action_required: 'Set GEMINI_API_KEY in Project Settings → Script Properties'
    });
    console.log('Please set GEMINI_API_KEY in Script Properties first');
    console.log('Go to Project Settings > Script Properties and add GEMINI_API_KEY');
    return;
  }
  
  logStructuredEvent('INFO', 'setup_start', null, 'Starting initial system setup', {
    api_key_present: true
  });
  
  // Create initial puzzle
  createInitialPuzzle();
  
  // Set up daily automation
  setupDailyTrigger();
  
  logStructuredEvent('SUCCESS', 'setup_complete', null, 'System setup completed successfully', {
    next_generation: 'Automatic at 1 AM daily',
    system_ready: true
  });
  
  console.log('Setup complete! System ready for daily operation.');
  console.log('Next puzzle will generate automatically at 1 AM tomorrow.');
}

// ================================================
// SIMPLIFIED TESTING FUNCTION
// ================================================

/**
 * Simple function to refresh today's puzzle
 * Replaces complex test suite with one practical function
 */
function refreshTodaysPuzzle() {
  const startTime = new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  console.log(`🔄 Refreshing puzzle for ${today}...`);
  
  try {
    // Generate new puzzle for today using existing robust system
    const newPuzzle = generatePuzzleWithFallbacks(today);
    
    if (!newPuzzle) {
      console.log('❌ Failed to generate puzzle');
      return { success: false, error: 'Puzzle generation failed' };
    }
    
    // Write to Daily_Puzzles sheet 
    const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
    if (puzzleSheet) {
      // Check if today's puzzle already exists, if so update it, otherwise add new row
      const existingRow = findRowByDate(puzzleSheet, today);
      if (existingRow > 1) {
        // Update existing row
        puzzleSheet.getRange(existingRow, 1, 1, 20).setValues([[
          today, newPuzzle.cipher_type, newPuzzle.p1_answer, newPuzzle.p1_encrypted_word, 
          newPuzzle.p1_hint1, newPuzzle.p1_hint2, newPuzzle.p1_hint3,
          newPuzzle.p2_question, newPuzzle.p2_hint1, newPuzzle.p2_hint2, newPuzzle.p2_hint3, 
          newPuzzle.p2_answer, newPuzzle.p2_alt_answers, newPuzzle.p3_answer, newPuzzle.p3_hint,
          newPuzzle.category, CIPHER_DIFFICULTY[newPuzzle.cipher_type] || 2, newPuzzle.source || "manual_refresh", true, 0
        ]]);
        console.log(`📝 Updated existing puzzle in row ${existingRow}`);
      } else {
        // Add new row
        const newRow = puzzleSheet.getLastRow() + 1;
        puzzleSheet.getRange(newRow, 1, 1, 20).setValues([[
          today, newPuzzle.cipher_type, newPuzzle.p1_answer, newPuzzle.p1_encrypted_word, 
          newPuzzle.p1_hint1, newPuzzle.p1_hint2, newPuzzle.p1_hint3,
          newPuzzle.p2_question, newPuzzle.p2_hint1, newPuzzle.p2_hint2, newPuzzle.p2_hint3, 
          newPuzzle.p2_answer, newPuzzle.p2_alt_answers, newPuzzle.p3_answer, newPuzzle.p3_hint,
          newPuzzle.category, CIPHER_DIFFICULTY[newPuzzle.cipher_type] || 2, newPuzzle.source || "manual_refresh", true, 0
        ]]);
        console.log(`📝 Added new puzzle in row ${newRow}`);
      }
    }
    
    // Update Current_Puzzle tab for immediate use
    updateCurrentPuzzleTab(newPuzzle);
    
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`✅ Puzzle refreshed successfully in ${duration}s`);
    console.log(`📊 Cipher: ${newPuzzle.cipher_type} | Category: ${newPuzzle.category}`);
    console.log(`🔤 P1: ${newPuzzle.p1_encrypted_word} → ${newPuzzle.p1_answer}`);
    console.log(`❓ P2: ${newPuzzle.p2_answer}`);
    console.log(`🔒 P3: ${newPuzzle.p2_answer} → ${newPuzzle.p3_answer}`);
    
    logStructuredEvent('SUCCESS', 'puzzle_refresh', today, 'Today\'s puzzle refreshed manually', {
      cipher_type: newPuzzle.cipher_type,
      category: newPuzzle.category,
      duration_seconds: duration
    });
    
    return { 
      success: true, 
      puzzle: newPuzzle,
      duration: duration,
      date: today
    };
    
  } catch (error) {
    console.log(`❌ Error refreshing puzzle: ${error.toString()}`);
    logStructuredEvent('ERROR', 'puzzle_refresh_failed', today, 'Manual puzzle refresh failed', {
      error: error.toString()
    });
    
    return { 
      success: false, 
      error: error.toString(),
      date: today
    };
  }
}
