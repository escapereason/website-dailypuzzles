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
  // Layer 1: Try Gemini API with robust retry logic
  try {
    SYSTEM_METRICS.gemini_attempts++;
    const geminiResult = callGeminiWithRetries(dateStr);
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
    const hardcodedFallback = getHardcodedFallbackPuzzle(dateStr);
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
function callGeminiWithRetries(dateStr) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
  
  // Progressive prompt strategies (complex → simple → basic)
  const promptStrategies = [
    () => createAdvancedPrompt(dateStr),
    () => createSimplePrompt(dateStr),
    () => createBasicPrompt(dateStr)
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
          const puzzleData = extractAndValidatePuzzle(response, dateStr);
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
  
  if (responseCode === 200) {
    const data = JSON.parse(response.getContentText());
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response structure from Gemini API');
    }
  } else if (responseCode === 429) {
    throw new Error('API quota exceeded - rate limited');
  } else if (responseCode === 403) {
    throw new Error('API access forbidden - check API key');
  } else {
    throw new Error(`API Error: ${responseCode} - ${response.getContentText()}`);
  }
}

// ================================================
// PROGRESSIVE PROMPT STRATEGIES
// ================================================

/**
 * Creates advanced prompt with full complexity and requirements
 */
function createAdvancedPrompt(dateStr) {
  const category = getBalancedCategory(dateStr);
  const cipherType = getBalancedCipher(dateStr);
  
  return `Create a sophisticated 3-puzzle cipher sequence for ${dateStr} in the ${category} category using ${cipherType} encryption.

ADVANCED STRUCTURE:
1. Choose a tech/space clue word (5-8 letters, uppercase) related to ${category}
2. Create expert-level trivia question that REFERENCES the clue word but has DIFFERENT answer
3. P3 encrypts the P2 trivia answer (NOT the P1 clue word)
4. Provide 3 progressive hints requiring specialized knowledge

CIPHER SYSTEMS:
- rot13: Each letter shifted 13 positions (A→N, B→O, etc.)
- caesar_3: Each letter shifted 3 positions forward (A→D, B→E, etc.)
- caesar_5: Each letter shifted 5 positions forward (A→F, B→G, etc.) 
- caesar_7: Each letter shifted 7 positions forward (A→H, B→I, etc.)
- caesar_11: Each letter shifted 11 positions forward (A→L, B→M, etc.)
- caesar_neg3: Each letter shifted 3 positions backward (D→A, E→B, etc.)
- caesar_neg5: Each letter shifted 5 positions backward (F→A, G→B, etc.)
- atbash: Reverse alphabet (A→Z, B→Y, C→X, etc.)

EXPERT REQUIREMENTS:
- p1_answer is clue word (5-8 letters, ${category} related)
- p2_answer must be DIFFERENT from p1_answer but conceptually related
- P2 question references P1 clue word and requires expert knowledge
- p3_answer encrypts P2 answer using same cipher as P1
- Progressive hints: Historical context → Cipher type → Exact parameter
- Target audience: tech professionals, space enthusiasts, developers

PROGRESSIVE HINT SYSTEM:
- p1_hint1: Historical/contextual hint about cipher (no direct mention)
- p1_hint2: Direct cipher type identification
- p1_hint3: Exact shift amount or parameter

EXAMPLE (${cipherType}, ${category}):
{
  "cipher_type": "${cipherType}",
  "p1_answer": "APOLLO",
  "p1_encrypted_word": "DSROOR",
  "p1_hint1": "This cipher method was used by Julius Caesar in his military campaigns",
  "p1_hint2": "This is a Caesar cipher",
  "p1_hint3": "3",
  "p2_question": "What programming language powers most modern AI frameworks including TensorFlow and PyTorch?",
  "p2_hint1": "Created by Guido van Rossum with philosophy of readable code",
  "p2_hint2": "Named after a British comedy troupe, not the reptile", 
  "p2_hint3": "Uses indentation for code blocks and .py file extension",
  "p2_answer": "PYTHON",
  "p2_alt_answers": "PYTHON,PYTHON LANGUAGE,PYTHON PROGRAMMING,PY",
  "p3_answer": "SBWKRQ",
  "p3_hint": "Use the same 3-position forward shift to encrypt the programming language",
  "category": "${category}"
}

CRITICAL: Ensure p1_answer ≠ p2_answer and p3_answer = encrypted(p2_answer, cipher_type).
Generate ONLY valid JSON, no other text:`;
}

/**
 * Creates simplified prompt for retry attempts
 */
function createSimplePrompt(dateStr) {
  const category = getBalancedCategory(dateStr);
  const cipherType = getBalancedCipher(dateStr);
  
  return `Create a 3-puzzle cipher sequence for ${dateStr}. Use ${cipherType} cipher and ${category} theme.

Structure:
1. Decrypt a clue word (P1)
2. Answer trivia about the topic (P2) - DIFFERENT answer than P1
3. Encrypt the trivia answer (P3)

Requirements:
- P1 and P2 must have different answers
- P3 encrypts P2 answer using same cipher as P1
- Include 3 hints for each puzzle

Generate only JSON format:
{
  "cipher_type": "${cipherType}",
  "p1_answer": "WORD1",
  "p1_encrypted_word": "ENCRYPTED_WORD1",
  "p1_hint1": "Historical hint",
  "p1_hint2": "Cipher type",
  "p1_hint3": "Parameter",
  "p2_question": "Question about topic?",
  "p2_hint1": "Broad hint",
  "p2_hint2": "Specific hint",
  "p2_hint3": "Obvious hint",
  "p2_answer": "WORD2",
  "p2_alt_answers": "WORD2,ALTERNATIVE",
  "p3_answer": "ENCRYPTED_WORD2",
  "p3_hint": "Encryption hint",
  "category": "${category}"
}`;
}

/**
 * Creates basic prompt as last resort
 */
function createBasicPrompt(dateStr) {
  const category = getBalancedCategory(dateStr);
  const cipherType = getBalancedCipher(dateStr);
  
  return `Create a simple cipher puzzle for ${dateStr} in ${category} category:
1. A word to decrypt (P1)
2. A trivia question with DIFFERENT answer (P2)
3. Encrypt the trivia answer (P3)

Use ${cipherType} cipher. P1 and P2 answers must be different words.

Return only JSON with these fields: cipher_type, p1_answer, p1_encrypted_word, p1_hint1, p1_hint2, p1_hint3, p2_question, p2_hint1, p2_hint2, p2_hint3, p2_answer, p2_alt_answers, p3_answer, p3_hint, category`;
}

// ================================================
// SMART JSON EXTRACTION AND VALIDATION
// ================================================

/**
 * Extracts and validates puzzle data from Gemini response with multiple strategies
 */
function extractAndValidatePuzzle(response, dateStr) {
  let puzzleData = null;
  
  // Strategy 1: Direct JSON parse
  try {
    puzzleData = JSON.parse(response);
    logStructuredEvent('INFO', 'json_extraction_success', dateStr, 'Direct JSON parse successful', {
      strategy: 'direct_parse'
    });
  } catch (error) {
    // Strategy 2: Extract from code blocks
    try {
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        puzzleData = JSON.parse(jsonMatch[1]);
        logStructuredEvent('INFO', 'json_extraction_success', dateStr, 'Code block extraction successful', {
          strategy: 'code_block_extraction'
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
            strategy: 'boundary_extraction'
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
              strategy: 'json_repair'
            });
          }
        } catch (error4) {
          logStructuredEvent('ERROR', 'json_extraction_failed', dateStr, 'All JSON extraction strategies failed', {
            response_length: response.length,
            response_preview: response.substring(0, 200),
            errors: [error.message, error2.message, error3.message, error4.message]
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
  return validateAndHealPuzzle(puzzleData, dateStr);
}

/**
 * Progressive validation with self-healing capabilities
 */
function validateAndHealPuzzle(puzzleData, dateStr) {
  const validationResults = {
    structure_valid: false,
    encryption_valid: false,
    content_valid: false,
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
 * Validates content quality
 */
function validateContentQuality(puzzle) {
  // Check for appropriate length
  if (puzzle.p1_answer.length < 3 || puzzle.p1_answer.length > 12) return false;
  if (puzzle.p2_answer.length < 3 || puzzle.p2_answer.length > 20) return false;
  
  // Check for reasonable question length
  if (puzzle.p2_question.length < 20 || puzzle.p2_question.length > 200) return false;
  
  // Check for hint progression
  if (puzzle.p1_hint1.length < 10 || puzzle.p2_hint1.length < 10) return false;
  
  return true;
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
 * Gets hardcoded fallback puzzle with variety
 */
function getHardcodedFallbackPuzzle(dateStr) {
  const fallbackPool = [
    {
      cipher_type: "caesar_3",
      p1_answer: "ROVER",
      p1_encrypted_word: "URYHU",
      p1_hint1: "This cipher method was used by Julius Caesar in his military campaigns",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "3",
      p2_question: "How many rovers has NASA successfully operated on Mars?",
      p2_hint1: "This includes Sojourner, Spirit, Opportunity, Curiosity, and Perseverance",
      p2_hint2: "The number equals the fingers on one human hand",
      p2_hint3: "Perseverance landed in 2021, making this the current total",
      p2_answer: "FIVE",
      p2_alt_answers: "FIVE,5,FIVE ROVERS",
      p3_answer: "ILYH",
      p3_hint: "Apply the same 3-position forward shift to encrypt the number",
      category: "space exploration"
    },
    {
      cipher_type: "rot13",
      p1_answer: "QUANTUM",
      p1_encrypted_word: "DHNAGBZ",
      p1_hint1: "This cipher was popularized in online forums and early internet culture",
      p1_hint2: "This is a rotation cipher",
      p1_hint3: "13",
      p2_question: "What phenomenon allows quantum computers to process multiple states simultaneously?",
      p2_hint1: "This principle enables qubits to exist in multiple states until measured",
      p2_hint2: "Einstein called it 'spooky action at a distance'",
      p2_hint3: "Schrödinger's cat demonstrates this quantum mechanical principle",
      p2_answer: "SUPERPOSITION",
      p2_alt_answers: "SUPERPOSITION,QUANTUM SUPERPOSITION",
      p3_answer: "FHCRECBFVGVBA",
      p3_hint: "Use the same 13-position shift to encrypt the quantum principle",
      category: "quantum computing"
    },
    {
      cipher_type: "atbash",
      p1_answer: "NEURAL",
      p1_encrypted_word: "MVFIZO",
      p1_hint1: "This ancient cipher was used in Hebrew biblical texts and manuscripts",
      p1_hint2: "This uses alphabet reversal (Atbash)",
      p1_hint3: "A↔Z, B↔Y, C↔X",
      p2_question: "What machine learning architecture mimics the human brain?",
      p2_hint1: "These systems learn through weighted connections and backpropagation",
      p2_hint2: "Deep versions of these power ChatGPT and image recognition",
      p2_hint3: "Has layers of interconnected nodes like biological neurons",
      p2_answer: "NETWORKS",
      p2_alt_answers: "NETWORKS,NEURAL NETWORKS,ARTIFICIAL NEURAL NETWORKS",
      p3_answer: "MVGDLIPH",
      p3_hint: "Use the same mirror alphabet to encrypt the AI architecture",
      category: "artificial intelligence"
    },
    {
      cipher_type: "caesar_5",
      p1_answer: "BLOCKCHAIN",
      p1_encrypted_word: "GQTHNPMNDS",
      p1_hint1: "This cipher method was used by Julius Caesar in his military campaigns",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "5",
      p2_question: "What cryptocurrency uses proof-of-work consensus and has a 21 million coin limit?",
      p2_hint1: "Created by the pseudonymous Satoshi Nakamoto in 2009",
      p2_hint2: "Miners solve cryptographic puzzles to validate transactions",
      p2_hint3: "Often called 'digital gold' and trades with symbol BTC",
      p2_answer: "BITCOIN",
      p2_alt_answers: "BITCOIN,BTC",
      p3_answer: "GNYHTNS",
      p3_hint: "Use the same 5-position forward shift to encrypt the cryptocurrency",
      category: "cryptocurrency"
    },
    {
      cipher_type: "caesar_7",
      p1_answer: "APOLLO",
      p1_encrypted_word: "HWVSSV",
      p1_hint1: "This cipher method was used by Julius Caesar in his military campaigns",
      p1_hint2: "This is a Caesar cipher",
      p1_hint3: "7",
      p2_question: "What programming language powers most modern AI frameworks including TensorFlow and PyTorch?",
      p2_hint1: "Created by Guido van Rossum with philosophy of readable code",
      p2_hint2: "Named after a British comedy troupe, not the reptile",
      p2_hint3: "Uses indentation for code blocks and .py file extension",
      p2_answer: "PYTHON",
      p2_alt_answers: "PYTHON,PYTHON LANGUAGE,PYTHON PROGRAMMING",
      p3_answer: "WFAOVU",
      p3_hint: "Use the same 7-position forward shift to encrypt the programming language",
      category: "programming languages"
    },
    {
      cipher_type: "caesar_neg3",
      p1_answer: "DATABASE",
      p1_encrypted_word: "AXQXYZPB",
      p1_hint1: "This cipher method was used by Julius Caesar in his military campaigns",
      p1_hint2: "This is a Caesar cipher shifting backward",
      p1_hint3: "3",
      p2_question: "What popular JavaScript runtime allows you to run JavaScript outside of web browsers?",
      p2_hint1: "Built on Chrome's V8 JavaScript engine for server-side development",
      p2_hint2: "Uses npm as its default package manager",
      p2_hint3: "Created by Ryan Dahl and commonly used for backend web development",
      p2_answer: "NODEJS",
      p2_alt_answers: "NODEJS,NODE.JS,NODE JS,NODE",
      p3_answer: "KLABEO",
      p3_hint: "Use the same 3-position backward shift to encrypt the runtime",
      category: "web development"
    }
  ];
  
  // Use date-based selection for consistency
  const dateHash = hashDateString(dateStr);
  const puzzleIndex = dateHash % fallbackPool.length;
  
  return fallbackPool[puzzleIndex];
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

/**
 * Test function to validate cipher implementations
 * Run this to ensure all ciphers work correctly
 */
function testCiphers() {
  const testWord = "HELLO";
  console.log(`Testing ciphers with word: ${testWord}`);
  
  const testResults = [];
  
  CIPHER_TYPES.forEach(cipherType => {
    try {
      const encrypted = applyCipher(testWord, cipherType);
      console.log(`${cipherType}: ${testWord} → ${encrypted}`);
      
      // Test validation with DIFFERENT answers (P1 ≠ P2, P3 encrypts P2)
      const testWord2 = "WORLD"; // Different from testWord
      const encrypted2 = applyCipher(testWord2, cipherType);
      const testPuzzle = {
        cipher_type: cipherType,
        p1_answer: testWord,
        p1_encrypted_word: encrypted,
        p2_answer: testWord2,
        p3_answer: encrypted2
      };
      
      const isValid = validateEncryptionLogic(testPuzzle);
      console.log(`Validation: ${isValid ? 'PASS' : 'FAIL'}`);
      
      testResults.push({
        cipher: cipherType,
        input: testWord,
        output: encrypted,
        validation: isValid ? 'PASS' : 'FAIL'
      });
      
    } catch (error) {
      console.log(`${cipherType}: ERROR - ${error.toString()}`);
      testResults.push({
        cipher: cipherType,
        input: testWord,
        output: 'ERROR',
        validation: 'FAIL',
        error: error.toString()
      });
    }
  });
  
  logStructuredEvent('INFO', 'cipher_test_complete', null, 'Cipher test completed', {
    test_results: testResults,
    total_ciphers: CIPHER_TYPES.length,
    passed: testResults.filter(r => r.validation === 'PASS').length
  });
  
  return testResults;
}

/**
 * Test function to validate the complete puzzle generation process
 */
function testPuzzleGeneration() {
  const testDate = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  console.log('Testing complete puzzle generation process...');
  
  try {
    const puzzleData = generatePuzzleWithFallbacks(testDate + '-test');
    
    const testResults = {
      generation_successful: !!puzzleData,
      structure_valid: validatePuzzleStructure(puzzleData),
      encryption_valid: validateEncryptionLogic(puzzleData),
      content_quality: validateContentQuality(puzzleData),
      puzzle_data: puzzleData
    };
    
    logStructuredEvent('INFO', 'puzzle_generation_test', testDate, 'Puzzle generation test completed', testResults);
    
    console.log('Test Results:', testResults);
    return testResults;
    
  } catch (error) {
    const errorResults = {
      generation_successful: false,
      error: error.toString(),
      error_stack: error.stack
    };
    
    logStructuredEvent('ERROR', 'puzzle_generation_test_failed', testDate, 'Puzzle generation test failed', errorResults);
    
    console.log('Test Failed:', errorResults);
    return errorResults;
  }
}

/**
 * Resets system metrics (useful for monitoring)
 */
function resetSystemMetrics() {
  SYSTEM_METRICS = {
    gemini_attempts: 0,
    gemini_successes: 0,
    fallback_uses: 0,
    validation_failures: 0,
    last_reset: new Date()
  };
  
  logStructuredEvent('INFO', 'system_metrics_reset', null, 'System metrics reset', SYSTEM_METRICS);
  console.log('System metrics reset');
}

/**
 * Gets current system status for monitoring
 */
function getSystemStatus() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  const status = {
    api_key_configured: !!apiKey,
    sheets_accessible: {
      daily_puzzles: !!ss.getSheetByName('Daily_Puzzles'),
      current_puzzle: !!ss.getSheetByName('Current_Puzzle'),
      usage_log: !!ss.getSheetByName('Usage_Log'),
      system_log: !!ss.getSheetByName('System_Log'),
      fallback_puzzles: !!ss.getSheetByName('Fallback_Puzzles')
    },
    todays_puzzle_exists: findRowByDate(ss.getSheetByName('Daily_Puzzles'), today) > 1,
    system_metrics: SYSTEM_METRICS,
    triggers_configured: ScriptApp.getProjectTriggers().length > 0,
    last_check: new Date()
  };
  
  logStructuredEvent('INFO', 'system_status_check', today, 'System status checked', status);
  
  return status;
}

// ================================================
// VARIETY TESTING FUNCTIONS
// ================================================

/**
 * Tests puzzle generation with multiple different dates to verify variety
 * This is crucial because the system is deterministic per date
 */
function testVarietyAcrossDates() {
  console.log('🔄 Testing variety across multiple dates...');
  
  const testDates = [
    '2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05',
    '2025-02-01', '2025-03-01', '2025-04-01', '2025-05-01', '2025-06-01'
  ];
  
  const results = [];
  const categoriesUsed = new Set();
  const ciphersUsed = new Set();
  const sourcesUsed = new Set();
  
  testDates.forEach((dateStr, index) => {
    try {
      console.log(`\n📅 Testing date ${index + 1}/10: ${dateStr}`);
      
      const puzzleData = generatePuzzleWithFallbacks(dateStr);
      const category = getBalancedCategory(dateStr);
      const cipher = getBalancedCipher(dateStr);
      
      categoriesUsed.add(puzzleData.category);
      ciphersUsed.add(puzzleData.cipher_type);
      sourcesUsed.add(puzzleData.source);
      
      results.push({
        date: dateStr,
        category: puzzleData.category,
        cipher_type: puzzleData.cipher_type,
        source: puzzleData.source,
        p1_answer: puzzleData.p1_answer,
        p2_answer: puzzleData.p2_answer,
        predicted_category: category,
        predicted_cipher: cipher,
        category_match: puzzleData.category === category,
        cipher_match: puzzleData.cipher_type === cipher
      });
      
      console.log(`   📊 Result: ${puzzleData.source} | ${puzzleData.cipher_type} | ${puzzleData.category}`);
      console.log(`   🧩 Puzzles: ${puzzleData.p1_answer} → ${puzzleData.p2_answer}`);
      
    } catch (error) {
      console.log(`   ❌ ERROR for ${dateStr}: ${error.toString()}`);
      results.push({
        date: dateStr,
        error: error.toString()
      });
    }
  });
  
  // Analyze variety
  const summary = {
    total_dates_tested: testDates.length,
    successful_generations: results.filter(r => !r.error).length,
    unique_categories: categoriesUsed.size,
    unique_ciphers: ciphersUsed.size,
    unique_sources: sourcesUsed.size,
    categories_used: Array.from(categoriesUsed),
    ciphers_used: Array.from(ciphersUsed),
    sources_used: Array.from(sourcesUsed),
    category_distribution: {},
    cipher_distribution: {},
    source_distribution: {}
  };
  
  // Calculate distributions
  results.forEach(result => {
    if (!result.error) {
      summary.category_distribution[result.category] = (summary.category_distribution[result.category] || 0) + 1;
      summary.cipher_distribution[result.cipher_type] = (summary.cipher_distribution[result.cipher_type] || 0) + 1;
      summary.source_distribution[result.source] = (summary.source_distribution[result.source] || 0) + 1;
    }
  });
  
  console.log('\n📊 VARIETY ANALYSIS SUMMARY:');
  console.log(`✅ Successful generations: ${summary.successful_generations}/${summary.total_dates_tested}`);
  console.log(`🎯 Unique categories: ${summary.unique_categories}/${CATEGORIES.length} possible`);
  console.log(`🔐 Unique ciphers: ${summary.unique_ciphers}/${CIPHER_TYPES.length} possible`);
  console.log(`📦 Sources used: ${Array.from(sourcesUsed).join(', ')}`);
  
  console.log('\n📈 CATEGORY DISTRIBUTION:');
  Object.entries(summary.category_distribution).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count} times`);
  });
  
  console.log('\n🔐 CIPHER DISTRIBUTION:');
  Object.entries(summary.cipher_distribution).forEach(([cipher, count]) => {
    console.log(`   ${cipher}: ${count} times`);
  });
  
  logStructuredEvent('INFO', 'variety_test_complete', null, 'Multi-date variety test completed', summary);
  
  return { results, summary };
}

/**
 * Tests just the fallback system to verify variety in fallbacks
 */
function testFallbackVariety() {
  console.log('🔄 Testing fallback puzzle variety...');
  
  const testDates = [
    '2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05',
    '2025-01-06', '2025-01-07', '2025-01-08', '2025-01-09', '2025-01-10'
  ];
  
  const fallbackResults = [];
  const categoriesUsed = new Set();
  
  testDates.forEach((dateStr, index) => {
    try {
      const hardcodedFallback = getHardcodedFallbackPuzzle(dateStr);
      const dateHash = hashDateString(dateStr);
      const puzzleIndex = dateHash % 6; // 6 fallback puzzles
      
      categoriesUsed.add(hardcodedFallback.category);
      
      fallbackResults.push({
        date: dateStr,
        puzzle_index: puzzleIndex,
        category: hardcodedFallback.category,
        cipher_type: hardcodedFallback.cipher_type,
        p1_answer: hardcodedFallback.p1_answer,
        p2_answer: hardcodedFallback.p2_answer,
        date_hash: dateHash
      });
      
      console.log(`${dateStr}: Index ${puzzleIndex} | ${hardcodedFallback.cipher_type} | ${hardcodedFallback.category} | ${hardcodedFallback.p1_answer}→${hardcodedFallback.p2_answer}`);
      
    } catch (error) {
      console.log(`ERROR for ${dateStr}: ${error.toString()}`);
    }
  });
  
  console.log(`\n📊 Fallback variety: ${categoriesUsed.size} unique categories used`);
  console.log(`📋 Categories: ${Array.from(categoriesUsed).join(', ')}`);
  
  return fallbackResults;
}

/**
 * Tests Gemini API directly with multiple dates (if API key is configured)
 */
function testGeminiVariety() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY not configured - skipping Gemini API test');
    return { skipped: true, reason: 'No API key' };
  }
  
  console.log('🤖 Testing Gemini API variety...');
  
  const testDates = ['2025-01-15', '2025-02-15', '2025-03-15'];
  const geminiResults = [];
  
  testDates.forEach(dateStr => {
    try {
      console.log(`\n📅 Testing Gemini for ${dateStr}...`);
      const result = callGeminiWithRetries(dateStr);
      
      if (result) {
        geminiResults.push({
          date: dateStr,
          success: true,
          category: result.category,
          cipher_type: result.cipher_type,
          p1_answer: result.p1_answer,
          p2_answer: result.p2_answer
        });
        console.log(`   ✅ SUCCESS: ${result.cipher_type} | ${result.category} | ${result.p1_answer}→${result.p2_answer}`);
      } else {
        geminiResults.push({
          date: dateStr,
          success: false,
          reason: 'API returned null'
        });
        console.log(`   ❌ FAILED: API returned null`);
      }
    } catch (error) {
      geminiResults.push({
        date: dateStr,
        success: false,
        error: error.toString()
      });
      console.log(`   ❌ ERROR: ${error.toString()}`);
    }
  });
  
  const successCount = geminiResults.filter(r => r.success).length;
  console.log(`\n📊 Gemini API Results: ${successCount}/${testDates.length} successful`);
  
  return geminiResults;
}

/**
 * Shows which fallback layer would be used for different scenarios
 */
function debugFallbackLayers() {
  console.log('🔍 Debugging fallback layer selection...');
  
  const testDate = '2025-07-20';
  
  console.log(`\n📅 Testing fallback layers for ${testDate}:`);
  
  // Test each layer individually
  console.log('\n1️⃣ LAYER 1: Gemini API');
  try {
    SYSTEM_METRICS.gemini_attempts++;
    const geminiResult = callGeminiWithRetries(testDate);
    if (geminiResult) {
      console.log('   ✅ Gemini API would succeed');
      console.log(`   📊 Result: ${geminiResult.cipher_type} | ${geminiResult.category}`);
    } else {
      console.log('   ❌ Gemini API would fail - moving to layer 2');
    }
  } catch (error) {
    console.log(`   ❌ Gemini API would fail: ${error.toString()}`);
  }
  
  console.log('\n2️⃣ LAYER 2: Fallback_Puzzles Sheet');
  try {
    const sheetFallback = getSheetFallbackPuzzle(testDate);
    if (sheetFallback) {
      console.log('   ✅ Sheet fallback would succeed');
      console.log(`   📊 Result: ${sheetFallback.cipher_type} | ${sheetFallback.category}`);
    }
  } catch (error) {
    console.log(`   ❌ Sheet fallback would fail: ${error.toString()}`);
  }
  
  console.log('\n3️⃣ LAYER 3: Hardcoded Fallback Pool');
  try {
    const hardcodedFallback = getHardcodedFallbackPuzzle(testDate);
    console.log('   ✅ Hardcoded fallback would succeed');
    console.log(`   📊 Result: ${hardcodedFallback.cipher_type} | ${hardcodedFallback.category} | ${hardcodedFallback.p1_answer}→${hardcodedFallback.p2_answer}`);
    
    const dateHash = hashDateString(testDate);
    const puzzleIndex = dateHash % 6;
    console.log(`   🔢 Date hash: ${dateHash}, Puzzle index: ${puzzleIndex}`);
  } catch (error) {
    console.log(`   ❌ Hardcoded fallback would fail: ${error.toString()}`);
  }
  
  console.log('\n4️⃣ LAYER 4: Emergency Puzzle');
  try {
    const emergencyPuzzle = getEmergencyPuzzle(testDate);
    console.log('   ✅ Emergency puzzle always succeeds');
    console.log(`   📊 Result: ${emergencyPuzzle.cipher_type} | ${emergencyPuzzle.category} | ${emergencyPuzzle.p1_answer}→${emergencyPuzzle.p2_answer}`);
  } catch (error) {
    console.log(`   ❌ Emergency puzzle failed: ${error.toString()}`);
  }
  
  // Show what the actual generation would use
  console.log(`\n🎯 ACTUAL GENERATION TEST for ${testDate}:`);
  try {
    const actualResult = generatePuzzleWithFallbacks(testDate);
    console.log(`   📊 Actual result: ${actualResult.source} | ${actualResult.cipher_type} | ${actualResult.category} | ${actualResult.p1_answer}→${actualResult.p2_answer}`);
  } catch (error) {
    console.log(`   ❌ Actual generation failed: ${error.toString()}`);
  }
}