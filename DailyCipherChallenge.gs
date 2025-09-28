/**
 * Daily Cipher Challenge System - Google Apps Script (SIMPLIFIED REWRITE)
 * 
 * This script automatically generates daily 3-puzzle cipher sequences using Gemini AI
 * Structure: Decrypt Word → Answer Trivia → Encrypt Answer
 * 
 * SIMPLIFIED DESIGN PHILOSOPHY:
 * - Make Gemini work reliably instead of building workarounds
 * - No fallback systems - fix the root cause instead
 * - Clean, simple validation with clear error messages
 * - Single prompt strategy focused on quality output
 * - Fail fast and clearly when issues occur
 * 
 * Required Setup:
 * 1. Set GEMINI_API_KEY in Script Properties
 * 2. Create Google Sheet with 4 tabs: Daily_Puzzles, Current_Puzzle, Usage_Log, System_Log
 * 3. Run setupDailyTrigger() to enable automation
 * 4. Run createInitialPuzzle() to populate first puzzle
 * 
 * @version 3.0.0
 * @author Claude (Anthropic) - Simplified Gemini-Only System
 */

// ================================================
// CONFIGURATION SECTION
// ================================================

// Cipher types available for puzzle generation (focused on most reliable)
const CIPHER_TYPES = ['reverse', 'letter_number', 'consonant_vowel_split', 'caesar_3', 'caesar_5', 'caesar_7', 'atbash', 'caesar_neg3'];

// Escape room immersive categories aligned with Reason Future Tech themes
const CATEGORIES = [
  'Space Exploration & Astronomy', 'Artificial Intelligence & Robotics', 'Cybersecurity & Digital Defense',
  'Time Travel & Temporal Mechanics', 'Alien Life & Extraterrestrial Contact', 'Virtual Reality & Simulation',
  'Quantum Computing & Physics', 'Biotechnology & Genetic Engineering', 'Post-Apocalyptic Survival',
  'Neural Networks & Brain Science'
];

// Difficulty system for puzzle generation
const DIFFICULTY_LEVELS = {
  2: {
    rating: 2,
    description: "moderate difficulty - accessible but challenging",
    guidance: "Use mainstream terms recognizable from popular science, tech news, or Discovery Channel - think RADIO, NEURAL, COSMOS level"
  },
  3: {
    rating: 3, 
    description: "medium difficulty - requires some knowledge",
    guidance: "Use scientifically interesting terms that are broadly recognizable - think TED Talk level, avoid specialist jargon like PCR or CEREBELLUM"
  }
};

// Updated API configuration for Gemini 2.5 Flash
const API_CONFIG = {
  MODEL: 'gemini-2.5-flash',  // Latest stable Flash model with thinking capabilities
  TEMPERATURE: 0.2,          // Low for consistent JSON output
  TIMEOUT: 30000,            // 30 second timeout
  MAX_TOKENS: 2048           // Increased to account for thinking tokens + response
};

// ================================================
// MAIN GENERATION FUNCTION
// ================================================

/**
 * Main function that generates daily puzzle sequences with simplified Gemini-only approach
 * Called automatically by daily trigger at 1 AM
 */
function generateDailyPuzzleSequence() {
  const startTime = new Date();
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey) {
    logEvent('CRITICAL', 'generation_failed', 'GEMINI_API_KEY not found in Script Properties');
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  
  if (!puzzleSheet) {
    logEvent('ERROR', 'generation_failed', 'Daily_Puzzles sheet not found');
    return;
  }
  
  // Get tomorrow's date using sheet timezone for consistency
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = Utilities.formatDate(tomorrow, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  // Check if puzzle already exists for tomorrow
  const existingRow = findRowByDate(puzzleSheet, dateStr);
  if (existingRow > 1) {
    logEvent('INFO', 'generation_skipped', `Puzzle already exists for ${dateStr}`);
    return;
  }
  
  logEvent('INFO', 'generation_start', `Starting puzzle generation for ${dateStr}`);
  
  try {
    // Single attempt with Gemini - no fallbacks
    const puzzleData = generatePuzzleWithGemini(dateStr);
    
    if (!puzzleData) {
      logEvent('ERROR', 'generation_failed', 'Gemini failed to generate valid puzzle');
      return;
    }
    
    // Write to sheet (18 columns: A-R, including new tracking columns)
    const newRow = puzzleSheet.getLastRow() + 1;
    puzzleSheet.getRange(newRow, 1, 1, 18).setValues([[
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
      puzzleData.generation_category,   // P: category
      puzzleData.generation_difficulty, // Q: difficulty
      puzzleData.generation_timestamp   // R: generation_timestamp
    ]]);
    
    // Update Current_Puzzle tab for Landbot integration
    updateCurrentPuzzleTab(puzzleData);
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    logEvent('SUCCESS', 'generation_complete', `Puzzle generated successfully in ${duration}ms`);
    
  } catch (error) {
    logEvent('ERROR', 'generation_error', `Generation failed: ${error.toString()}`);
    console.error('Error generating puzzle sequence:', error);
    throw error;
  }
}

/**
 * Generates puzzle using Gemini API with simplified, focused approach
 */
function generatePuzzleWithGemini(dateStr) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${API_CONFIG.MODEL}:generateContent?key=${apiKey}`;
  
  // Get recent answers for uniqueness (simplified to 7 days)
  const excludedAnswers = getRecentAnswers(7);
  
  // Single, focused prompt - content only, no encryption
  const promptData = createContentOnlyPrompt(dateStr, excludedAnswers);
  const prompt = promptData.prompt;
  
  // Retry mechanism for anti-duplication
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    logEvent('INFO', 'gemini_call_start', `Calling Gemini API for ${dateStr} (attempt ${attempt}/${maxRetries})`);
    
    try {
      // Get fresh prompt for each attempt to ensure variation
      const currentPromptData = (attempt === 1) ? promptData : createContentOnlyPrompt(dateStr, excludedAnswers);
      const currentPrompt = currentPromptData.prompt;
      
      const response = callGeminiAPI(apiUrl, currentPrompt);
      if (!response) {
        logEvent('WARNING', 'gemini_no_response', `Gemini API returned no response (attempt ${attempt})`);
        continue; // Try again
      }
      
      const puzzleData = parseAndValidatePuzzle(response, dateStr);
      if (!puzzleData) {
        logEvent('WARNING', 'gemini_invalid_puzzle', `Gemini generated invalid puzzle data (attempt ${attempt})`);
        continue; // Try again with different prompt
      }
      
      // Add generation metadata to puzzle data
      puzzleData.generation_category = currentPromptData.category;
      puzzleData.generation_difficulty = currentPromptData.difficulty;
      puzzleData.generation_timestamp = currentPromptData.timestamp;
      
      logEvent('SUCCESS', 'gemini_success', `Gemini generated valid puzzle on attempt ${attempt} - Category: ${currentPromptData.category}, Difficulty: ${currentPromptData.difficulty}`);
      return puzzleData;
      
    } catch (error) {
      logEvent('WARNING', 'gemini_api_error', `Gemini API error on attempt ${attempt}: ${error.toString()}`);
      if (attempt === maxRetries) {
        logEvent('ERROR', 'gemini_all_attempts_failed', `All ${maxRetries} Gemini attempts failed`);
        return null;
      }
    }
  }
  
  return null;
}

/**
 * Makes the actual API call to Gemini with optimized settings and comprehensive logging
 */
function callGeminiAPI(apiUrl, prompt) {
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: API_CONFIG.TEMPERATURE,
      topP: 0.8,
      maxOutputTokens: API_CONFIG.MAX_TOKENS,
      response_mime_type: "application/json"
    },
    systemInstruction: {
      parts: [{
        text: "You are a puzzle generator. Always respond with valid JSON only. Disable thinking to conserve tokens."
      }]
    }
  };
  
  const payloadString = JSON.stringify(payload);
  const payloadSize = payloadString.length;
  
  // Log API call details
  logEvent('DEBUG', 'gemini_api_call', `URL: ${apiUrl}, Model: ${API_CONFIG.MODEL}, Payload size: ${payloadSize} chars, Prompt length: ${prompt.length} chars`);
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: payloadString,
    muteHttpExceptions: true,
    timeout: API_CONFIG.TIMEOUT
  };
  
  const apiCallStart = new Date();
  const response = UrlFetchApp.fetch(apiUrl, options);
  const apiCallEnd = new Date();
  const apiCallDuration = apiCallEnd - apiCallStart;
  
  const responseCode = response.getResponseCode();
  const rawResponseText = response.getContentText();
  const responseSize = rawResponseText.length;
  
  // Log API response details
  logEvent('DEBUG', 'gemini_api_response', `Response code: ${responseCode}, Response size: ${responseSize} chars, Duration: ${apiCallDuration}ms`);
  
  if (responseCode === 200) {
    try {
      const data = JSON.parse(rawResponseText);

      // Log usage metadata for debugging
      if (data.usageMetadata) {
        logEvent('DEBUG', 'gemini_token_usage', `Prompt: ${data.usageMetadata.promptTokenCount}, Total: ${data.usageMetadata.totalTokenCount}, Thoughts: ${data.usageMetadata.thoughtsTokenCount || 0}`);
      }

      // Check for truncation first
      if (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'MAX_TOKENS') {
        logEvent('WARNING', 'gemini_response_truncated', `Response truncated due to token limit. UsageMetadata: ${JSON.stringify(data.usageMetadata)}`);

        // Try to extract partial content if available
        if (data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
          const partialText = data.candidates[0].content.parts[0].text || '';
          if (partialText.length > 0) {
            logEvent('INFO', 'gemini_partial_response', `Extracted partial response: ${partialText.length} chars`);
            return partialText;
          }
        }

        throw new Error(`Response truncated with no content - thinking tokens: ${data.usageMetadata?.thoughtsTokenCount || 0}, total: ${data.usageMetadata?.totalTokenCount || 0}`);
      }

      // Normal response processing
      if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
        const extractedText = data.candidates[0].content.parts[0].text;
        if (!extractedText || extractedText.trim() === '') {
          throw new Error('Empty text content in response');
        }
        logEvent('SUCCESS', 'gemini_api_success', `Successfully extracted ${extractedText.length} chars from Gemini response`);
        return extractedText;
      } else {
        logEvent('ERROR', 'gemini_response_structure_invalid', `Invalid response structure: ${JSON.stringify(data)}`);
        throw new Error('Invalid response structure from Gemini API - missing content.parts');
      }
    } catch (parseError) {
      logEvent('ERROR', 'gemini_response_parse_failed', `Failed to parse response: ${parseError.toString()}, Raw response: ${rawResponseText.substring(0, 500)}...`);
      throw new Error(`Failed to parse Gemini response: ${parseError.toString()}`);
    }
  } else if (responseCode === 429) {
    logEvent('ERROR', 'gemini_rate_limited', `API quota exceeded - rate limited. Response: ${rawResponseText}`);
    throw new Error('API quota exceeded - rate limited');
  } else if (responseCode === 403) {
    logEvent('ERROR', 'gemini_access_forbidden', `API access forbidden - check API key. Response: ${rawResponseText}`);
    throw new Error('API access forbidden - check API key');
  } else {
    logEvent('ERROR', 'gemini_api_error', `API Error ${responseCode}: ${rawResponseText}`);
    throw new Error(`API Error: ${responseCode} - ${rawResponseText}`);
  }
}

/**
 * Provides category-specific guidance and examples for escape room themes
 */
function getCategoryGuidance(category) {
  const guidance = {
    'Space Exploration & Astronomy': {
      focus: 'celestial objects, space phenomena, spacecraft components, astronomical terms',
      example: {
        p1_answer: 'COSMOS',
        p2_question: 'What do you call the invisible force that keeps planets in orbit around stars?',
        p2_hint1: 'Newton discovered this fundamental force',
        p2_hint2: 'It gets weaker with distance but never disappears',
        p2_hint3: 'What goes up must come down because of this',
        p2_answer: 'GRAVITY',
        p2_alt_answers: 'GRAVITY,GRAVITATIONAL FORCE'
      }
    },
    'Artificial Intelligence & Robotics': {
      focus: 'AI concepts, algorithms, machine learning terms, robotic components',
      example: {
        p1_answer: 'ROBOTIC',
        p2_question: 'What type of learning uses trial and error to maximize rewards?',
        p2_hint1: 'Used to train game-playing AI systems',
        p2_hint2: 'Learns through feedback and consequences',
        p2_hint3: 'Like training a pet with treats and corrections',
        p2_answer: 'LEARNING',
        p2_alt_answers: 'LEARNING,MACHINE LEARNING'
      }
    },
    'Cybersecurity & Digital Defense': {
      focus: 'encryption methods, security concepts, hacking terms, digital protection',
      example: {
        p1_answer: 'FIREWALL',
        p2_question: 'What process scrambles data to protect it from unauthorized access?',
        p2_hint1: 'Used to secure messages and files',
        p2_hint2: 'Makes data unreadable without the key',
        p2_hint3: 'Banks and websites use this for security',
        p2_answer: 'ENCRYPTION',
        p2_alt_answers: 'ENCRYPTION,ENCRYPTING'
      }
    },
    'Time Travel & Temporal Mechanics': {
      focus: 'physics concepts, temporal phenomena, science fiction terms, relativity',
      example: {
        p1_answer: 'PARADOX',
        p2_question: 'What Einstein theory explains how time slows down at high speeds?',
        p2_hint1: 'Shows that space and time are connected',
        p2_hint2: 'Explains why GPS satellites need time corrections',
        p2_hint3: 'E=mc² comes from this famous theory',
        p2_answer: 'RELATIVITY',
        p2_alt_answers: 'RELATIVITY,SPECIAL RELATIVITY'
      }
    },
    'Alien Life & Extraterrestrial Contact': {
      focus: 'exoplanets, astrobiology terms, SETI concepts, space exploration',
      example: {
        p1_answer: 'SIGNAL',
        p2_question: 'What zone around a star could support liquid water on planets?',
        p2_hint1: 'Not too hot, not too cold for life',
        p2_hint2: 'Also called the habitable zone',
        p2_hint3: 'Named after a fairy tale character',
        p2_answer: 'GOLDILOCKS',
        p2_alt_answers: 'GOLDILOCKS,HABITABLE ZONE'
      }
    },
    'Virtual Reality & Simulation': {
      focus: 'VR/AR technology, simulation concepts, immersive tech terms',
      example: {
        p1_answer: 'AVATAR',
        p2_question: 'What technology creates immersive 3D computer environments?',
        p2_hint1: 'Uses special headsets and controllers',
        p2_hint2: 'Makes you feel like you\'re inside a digital world',
        p2_hint3: 'Popular for gaming and training simulations',
        p2_answer: 'VIRTUAL',
        p2_alt_answers: 'VIRTUAL,VIRTUAL REALITY'
      }
    },
    'Quantum Computing & Physics': {
      focus: 'quantum phenomena, physics principles, computing concepts',
      example: {
        p1_answer: 'QUANTUM',
        p2_question: 'What fundamental force holds atomic nuclei together?',
        p2_hint1: 'Overcomes electrical repulsion between protons',
        p2_hint2: 'One of the four fundamental forces of physics',
        p2_hint3: 'Released in nuclear fusion and fission',
        p2_answer: 'NUCLEAR',
        p2_alt_answers: 'NUCLEAR,NUCLEAR FORCE'
      }
    },
    'Biotechnology & Genetic Engineering': {
      focus: 'genetic terms, biotechnology concepts, medical innovations',
      example: {
        p1_answer: 'GENETICS',
        p2_question: 'What molecule carries genetic information in all living things?',
        p2_hint1: 'Found in the nucleus of every cell',
        p2_hint2: 'Has a famous double helix structure',
        p2_hint3: 'Watson and Crick discovered its structure',
        p2_answer: 'DNA',
        p2_alt_answers: 'DNA,GENETIC CODE'
      }
    },
    'Post-Apocalyptic Survival': {
      focus: 'survival concepts, resource management, disaster preparedness',
      example: {
        p1_answer: 'BUNKER',
        p2_question: 'What type of energy doesn\'t depend on the electrical grid?',
        p2_hint1: 'Generated by panels that face the sun',
        p2_hint2: 'Clean energy that never runs out',
        p2_hint3: 'Powers calculators and space stations',
        p2_answer: 'SOLAR',
        p2_alt_answers: 'SOLAR,SOLAR POWER'
      }
    },
    'Neural Networks & Brain Science': {
      focus: 'neuroscience terms, brain concepts, cognitive science',
      example: {
        p1_answer: 'NEURAL',
        p2_question: 'What organ controls thinking, memory, and movement in humans?',
        p2_hint1: 'Contains about 86 billion neurons',
        p2_hint2: 'Protected by the skull',
        p2_hint3: 'Controls all body functions and consciousness',
        p2_answer: 'BRAIN',
        p2_alt_answers: 'BRAIN,HUMAN BRAIN'
      }
    }
  };
  
  return guidance[category] || {
    focus: 'scientific concepts, phenomena, and technical terms',
    example: {
      p1_answer: 'SYSTEM',
      p2_question: 'What do you call the building blocks of all matter?',
      p2_hint1: 'Everything is made of these tiny particles',
      p2_hint2: 'They combine to form molecules',
      p2_hint3: 'Oxygen and hydrogen are examples',
      p2_answer: 'ATOMS',
      p2_alt_answers: 'ATOMS,ATOMIC PARTICLES'
    }
  };
}

/**
 * Creates simplified prompt focused on content generation only - NO ENCRYPTION
 * Returns object with prompt and metadata for database storage
 */
function createContentOnlyPrompt(dateStr, excludedAnswers) {
  const category = getRandomCategory();
  const difficulty = getRandomDifficulty();
  const exclusionText = createExclusionText(excludedAnswers);
  const categoryGuidance = getCategoryGuidance(category);
  const difficultyInfo = DIFFICULTY_LEVELS[difficulty];
  const timestamp = new Date().toISOString();
  
  const variationSeed = Math.floor(Math.random() * 1000);
  const promptVariations = [
    "Create fresh puzzle content",
    "Generate unique puzzle content", 
    "Develop original puzzle content",
    "Build new puzzle content"
  ];
  const selectedVariation = promptVariations[variationSeed % promptVariations.length];
  
  const prompt = `${selectedVariation} for ${dateStr} in ${category} category.${exclusionText}

GENERATION PARAMETERS:
- Session ID: ${variationSeed}
- Difficulty Level: ${difficulty} (${difficultyInfo.description})
- Category Focus: ${category}
- Generation Time: ${timestamp}
- Variation Seed: ${variationSeed}
- Difficulty Guidance: ${difficultyInfo.guidance}

STRICT REQUIREMENTS:
1. p1_answer: Mainstream word (5-8 letters, ${category} related) that people know
2. p2_question: Trivia question about DIFFERENT word than p1_answer  
3. p2_answer: DIFFERENT from p1_answer, also mainstream recognizable
4. All hints should be accessible to general public
5. p1_answer ≠ p2_answer (MUST be different words)

WORD SELECTION GUIDANCE:
- GOOD TECHNICAL TERMS: RADIO, NEURAL, COSMOS, ENTROPY, PHISHING, PHOTON, GRAVITY, DOPAMINE, RANSOMWARE, QUANTUM, ALGORITHM
- AVOID ULTRA-SPECIALIST TERMS: PCR, CEREBELLUM, STEREOPSIS (require advanced degrees to understand)
- TARGET LEVEL: Terms a tech-savvy professional would recognize from news, documentaries, Popular Science magazine
- KEY DISTINCTION: "Broadly known technical terms" vs "Academic specialist jargon"

BRAND-POSITIVE CONTENT REQUIREMENTS:
- Focus on inspiring scientific concepts that spark curiosity about the future
- PREFER categories: Space exploration, clean energy, digital innovation, physics phenomena
- TARGET FEELING: "This makes me excited about learning and discovery"
- AVOID biological processes, waste-related terms, or anything with unpleasant associations
- FORBIDDEN EXAMPLES: FERMENT, BIOMASS, BACTERIA, MOLD, DECAY, DIGEST, WASTE, FUNGUS, ROT, SPOILAGE
- PREFERRED EXAMPLES: SOLAR, QUANTUM, NEURAL, COSMOS, GRAVITY, DIGITAL, PHOTON, ENERGY, FUSION, LASER
- BRAND TEST: "Would this word make someone feel positive about science and technology?"
- Emphasize concepts associated with human achievement, exploration, and technological progress

CRITICAL - ABSOLUTELY NO COMPANY NAMES:
- FORBIDDEN: Company names, brand names, corporate entities
- EXAMPLES TO AVOID: Google, Apple, Tesla, Meta, Amazon, Microsoft, etc.
- REQUIRED: ${categoryGuidance.focus}
- USE: Scientific concepts, phenomena, technical terms that are broadly recognizable

CONTENT VARIETY REQUIREMENTS:
- Generate content that is DIFFERENT from the provided example
- Use alternative concepts within the ${category} theme
- Ensure answers are NOT identical to example answers
- Focus on DIFFERENT ${categoryGuidance.focus} than shown in example

REFERENCE EXAMPLE (DO NOT COPY - create different content):
{
  "p1_answer": "${categoryGuidance.example.p1_answer}",
  "p2_question": "${categoryGuidance.example.p2_question}",
  "p2_answer": "${categoryGuidance.example.p2_answer}",
  "p2_alt_answers": "${categoryGuidance.example.p2_alt_answers}"
}

Generate ONLY valid JSON with this exact structure, using DIFFERENT content than the example:
{
  "p1_answer": "YOUR_UNIQUE_WORD",
  "p2_question": "Your unique trivia question here",
  "p2_hint1": "First hint for trivia",
  "p2_hint2": "Second hint for trivia", 
  "p2_hint3": "Third hint for trivia",
  "p2_answer": "YOUR_DIFFERENT_ANSWER",
  "p2_alt_answers": "ALTERNATIVE1,ALTERNATIVE2"
}`;

  logEvent('DEBUG', 'prompt_variation', `Using variation: "${selectedVariation}", Seed: ${variationSeed}, Category: ${category}, Difficulty: ${difficulty}`);

  return {
    prompt: prompt,
    category: category,
    difficulty: difficulty,
    timestamp: timestamp
  };
}

/**
 * Parses Gemini content and adds encryption automatically
 */
function parseAndValidatePuzzle(response, dateStr) {
  // Enhanced logging - log full response for debugging
  logEvent('INFO', 'gemini_response_received', `Full Gemini response: ${response}`);
  
  let contentData;
  
  // Parse the simplified JSON structure from Gemini
  try {
    // Remove potential markdown formatting
    const cleanResponse = response.replace(/```json|```/g, '').trim();
    contentData = JSON.parse(cleanResponse);
    logEvent('SUCCESS', 'json_parse_success', 'Successfully parsed Gemini JSON response');
  } catch (error) {
    logEvent('ERROR', 'json_parse_failed', `JSON parsing failed: ${error.toString()}`);
    return null;
  }
  
  // Validate basic content structure (simplified - no encryption fields)
  const requiredFields = ['p1_answer', 'p2_question', 'p2_hint1', 'p2_hint2', 'p2_hint3', 'p2_answer', 'p2_alt_answers'];
  
  for (const field of requiredFields) {
    if (!contentData[field] || contentData[field].toString().trim() === '') {
      logEvent('ERROR', 'missing_field', `Missing required field: ${field}`);
      return null;
    }
  }
  
  // Validate p1 and p2 answers are different
  if (contentData.p1_answer.toUpperCase() === contentData.p2_answer.toUpperCase()) {
    logEvent('ERROR', 'duplicate_answers', `p1_answer "${contentData.p1_answer}" and p2_answer "${contentData.p2_answer}" must be different`);
    return null;
  }
  
  // Check against recent answers to prevent duplicates
  const recentAnswers = getRecentAnswers(7);
  if (recentAnswers.has(contentData.p1_answer.toUpperCase()) || recentAnswers.has(contentData.p2_answer.toUpperCase())) {
    logEvent('WARNING', 'recent_duplicate_detected', `Generated answers "${contentData.p1_answer}" or "${contentData.p2_answer}" match recent puzzles`);
    return null; // Force regeneration with different prompt
  }
  
  
  // NOW ADD ALL ENCRYPTION AUTOMATICALLY
  const cipherType = getRandomCipher();
  logEvent('INFO', 'cipher_selected', `Randomly selected cipher: ${cipherType}`);
  
  try {
    // Encrypt p1_answer to create the puzzle word to decrypt
    const p1_encrypted_word = applyCipher(contentData.p1_answer, cipherType);
    logEvent('SUCCESS', 'p1_encryption', `${contentData.p1_answer} → ${p1_encrypted_word} using ${cipherType}`);
    
    // Encrypt p2_answer to create the final puzzle answer
    const p3_answer = applyCipher(contentData.p2_answer, cipherType);
    logEvent('SUCCESS', 'p3_encryption', `${contentData.p2_answer} → ${p3_answer} using ${cipherType}`);
    
    // Auto-generate cipher hints based on cipher type
    const cipherHints = generateCipherHints(cipherType);
    
    // Build complete puzzle with all encryption added
    const completePuzzle = {
      cipher_type: cipherType,
      p1_answer: contentData.p1_answer.toUpperCase(),
      p1_encrypted_word: p1_encrypted_word,
      p1_hint1: cipherHints.hint1,
      p1_hint2: cipherHints.hint2,
      p1_hint3: cipherHints.hint3,
      p2_question: contentData.p2_question,
      p2_hint1: contentData.p2_hint1,
      p2_hint2: contentData.p2_hint2,
      p2_hint3: contentData.p2_hint3,
      p2_answer: contentData.p2_answer.toUpperCase(),
      p2_alt_answers: contentData.p2_alt_answers.toUpperCase(),
      p3_answer: p3_answer,
      p3_hint: cipherType === 'consonant_vowel_split' 
        ? `Separate "${contentData.p2_answer}" into consonants and vowels like the first puzzle`
        : `Use the same ${cipherType} encryption to encrypt "${contentData.p2_answer}"`
    };
    
    logEvent('SUCCESS', 'puzzle_complete', `Complete puzzle generated with ${cipherType} encryption`);
    return completePuzzle;
    
  } catch (error) {
    logEvent('ERROR', 'encryption_failed', `Encryption failed: ${error.toString()}`);
    return null;
  }
}

/**
 * Applies cipher encryption to a word - SIMPLIFIED VERSION
 */
function applyCipher(word, cipherType) {
  if (!word || typeof word !== 'string') {
    throw new Error('Invalid word for cipher application');
  }
  
  const upperWord = word.toUpperCase();
  
  // Handle special ciphers that don't use character-by-character substitution
  if (cipherType === 'reverse') {
    return upperWord.split('').reverse().join('');
  }
  
  if (cipherType === 'letter_number') {
    return upperWord.split('').map(char => {
      if (char >= 'A' && char <= 'Z') {
        return (char.charCodeAt(0) - 64).toString(); // A=1, B=2, etc.
      }
      return char;
    }).join(' ');
  }
  
  if (cipherType === 'consonant_vowel_split') {
    const vowels = 'AEIOU';
    let consonants = '';
    let vowelChars = '';
    
    // Process each character
    for (let i = 0; i < upperWord.length; i++) {
      const char = upperWord[i];
      if (char >= 'A' && char <= 'Z') {  // Only process letters
        if (vowels.includes(char)) {
          vowelChars += char;
        } else {
          consonants += char;
        }
      }
      // Skip non-alphabetic characters entirely
    }
    
    // Handle edge cases gracefully
    if (consonants === '' && vowelChars === '') {
      return upperWord; // No letters found - return original
    }
    if (consonants === '') {
      return vowelChars; // No consonants - return vowels only
    }
    if (vowelChars === '') {
      return consonants; // No vowels - return consonants only
    }
    
    return consonants + ' ' + vowelChars;
  }
  
  // Handle substitution ciphers (Caesar, Atbash)
  let result = '';
  
  for (let i = 0; i < upperWord.length; i++) {
    const char = upperWord[i];
    if (char >= 'A' && char <= 'Z') {
      const charCode = char.charCodeAt(0) - 65; // A=0, B=1, etc.
      let newCharCode;
      
      switch (cipherType) {
        case 'caesar_3':
          newCharCode = (charCode + 3) % 26;
          break;
        case 'caesar_5':
          newCharCode = (charCode + 5) % 26;
          break;
        case 'caesar_7':
          newCharCode = (charCode + 7) % 26;
          break;
        case 'caesar_neg3':
          newCharCode = (charCode - 3 + 26) % 26;
          break;
        case 'atbash':
          newCharCode = 25 - charCode; // A=25, B=24, etc.
          break;
        default:
          throw new Error(`Unknown cipher type: ${cipherType}`);
      }
      
      result += String.fromCharCode(newCharCode + 65);
    } else {
      result += char; // Keep non-alphabetic characters as-is
    }
  }
  
  return result;
}

/**
 * Generates appropriate cipher hints based on cipher type
 */
function generateCipherHints(cipherType) {
  const hintTemplates = {
    'reverse': {
      hint1: 'This cipher simply reverses the order of all letters in the word',
      hint2: 'Read the word backwards - last letter becomes first',
      hint3: 'Just flip the entire word around (HELLO becomes OLLEH)'
    },
    'letter_number': {
      hint1: 'Each letter has been replaced with its position number in the alphabet',
      hint2: 'A=1, B=2, C=3, and so on through Z=26',
      hint3: 'Convert each number back to its corresponding alphabet letter'
    },
    'consonant_vowel_split': {
      hint1: 'The letters have been reorganized into two groups based on their type',
      hint2: 'Vowels (A, E, I, O, U) and consonants have been separated',
      hint3: 'Consonants come first, then vowels - combine them back in original order'
    },
    'caesar_3': {
      hint1: 'This cipher method was used by Julius Caesar in his military campaigns',
      hint2: 'Caesar cipher - shift each letter forward',
      hint3: 'Shift each letter exactly 3 positions forward (A→D, B→E, etc.)'
    },
    'caesar_5': {
      hint1: 'Ancient Roman military encryption technique with a fixed shift pattern',
      hint2: 'Caesar cipher with a moderate shift amount',
      hint3: 'Shift each letter exactly 5 positions forward (A→F, B→G, etc.)'
    },
    'caesar_7': {
      hint1: 'Classical substitution cipher used for military communications',
      hint2: 'Caesar cipher with a larger shift amount',
      hint3: 'Shift each letter exactly 7 positions forward (A→H, B→I, etc.)'
    },
    'caesar_11': {
      hint1: 'Roman encryption method with a significant letter displacement',
      hint2: 'Caesar cipher with a high shift value',
      hint3: 'Shift each letter exactly 11 positions forward (A→L, B→M, etc.)'
    },
    'caesar_neg3': {
      hint1: 'Like Caesar cipher but shifts letters in the opposite direction',
      hint2: 'Reverse Caesar cipher - shift letters backward',
      hint3: 'Shift each letter exactly 3 positions backward (D→A, E→B, etc.)'
    },
    'caesar_neg5': {
      hint1: 'Ancient cipher technique using backward letter substitution',
      hint2: 'Reverse Caesar cipher with moderate backward shift',
      hint3: 'Shift each letter exactly 5 positions backward (F→A, G→B, etc.)'
    },
    'atbash': {
      hint1: 'Ancient Hebrew cipher where the alphabet is reversed',
      hint2: 'Atbash cipher - mirror the alphabet',
      hint3: 'Replace each letter with its opposite (A→Z, B→Y, C→X, etc.)'
    }
  };
  
  return hintTemplates[cipherType] || {
    hint1: 'This is a substitution cipher',
    hint2: 'Each letter is replaced with another letter',
    hint3: 'Follow the cipher pattern to decode'
  };
}

// ================================================
// UTILITY FUNCTIONS
// ================================================

/**
 * Simple event logging function
 */
function logEvent(level, eventType, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${eventType} - ${message}`);
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const systemLog = ss.getSheetByName('System_Log');
    
    if (systemLog) {
      systemLog.appendRow([timestamp, level, eventType, message]);
    }
  } catch (error) {
    console.error('Failed to write to System_Log:', error);
  }
}

/**
 * Updates Current_Puzzle tab for Landbot integration
 */
function updateCurrentPuzzleTab(puzzleData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentSheet = ss.getSheetByName('Current_Puzzle');
  
  if (!currentSheet) {
    logEvent('WARNING', 'current_puzzle_sheet_missing', 'Current_Puzzle sheet not found');
    return;
  }
  
  // Clear existing data and add new puzzle to row 2
  currentSheet.clear();
  
  // Add headers
  const headers = [
    'cipher_type', 'p1_answer', 'p1_encrypted_word', 'p1_hint1', 'p1_hint2', 'p1_hint3',
    'p2_question', 'p2_hint1', 'p2_hint2', 'p2_hint3', 'p2_answer', 'p2_alt_answers',
    'p3_answer', 'p3_hint', 'category'
  ];
  currentSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Add puzzle data to row 2
  const puzzleRow = [
    puzzleData.cipher_type, puzzleData.p1_answer, puzzleData.p1_encrypted_word,
    puzzleData.p1_hint1, puzzleData.p1_hint2, puzzleData.p1_hint3,
    puzzleData.p2_question, puzzleData.p2_hint1, puzzleData.p2_hint2, puzzleData.p2_hint3,
    puzzleData.p2_answer, puzzleData.p2_alt_answers, puzzleData.p3_answer, puzzleData.p3_hint,
    puzzleData.category || 'Technology'
  ];
  currentSheet.getRange(2, 1, 1, puzzleRow.length).setValues([puzzleRow]);
  
  logEvent('INFO', 'current_puzzle_updated', 'Current_Puzzle tab updated successfully');
}


/**
 * Gets recent answers for uniqueness checking - SIMPLIFIED VERSION
 */
function getRecentAnswers(days = 7) {
  const excludedAnswers = new Set();
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
    
    if (!puzzleSheet) {
      return excludedAnswers;
    }
    
    const data = puzzleSheet.getDataRange().getValues();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    for (let i = 1; i < data.length; i++) { // Skip header row
      const dateStr = data[i][0];
      const rowDate = new Date(dateStr);
      
      if (rowDate >= cutoffDate) {
        const p1Answer = data[i][2]; // Column C
        const p2Answer = data[i][11]; // Column L
        
        if (p1Answer) excludedAnswers.add(p1Answer.toString().toUpperCase());
        if (p2Answer) excludedAnswers.add(p2Answer.toString().toUpperCase());
      }
    }
  } catch (error) {
    logEvent('WARNING', 'recent_answers_error', `Error getting recent answers: ${error.toString()}`);
  }
  
  return excludedAnswers;
}

/**
 * Creates exclusion text for prompts
 */
function createExclusionText(excludedAnswers) {
  if (!excludedAnswers || excludedAnswers.size === 0) {
    return '';
  }
  
  const recentList = Array.from(excludedAnswers).slice(0, 5).join(', ');
  return `\n\nAVOID these recent answers: ${recentList}`;
}

/**
 * Gets truly random category for variety (no date-based determinism)
 */
function getRandomCategory() {
  const randomIndex = Math.floor(Math.random() * CATEGORIES.length);
  const selectedCategory = CATEGORIES[randomIndex];
  logEvent('DEBUG', 'category_selected', `Randomly selected category: ${selectedCategory} (index ${randomIndex})`);
  return selectedCategory;
}

/**
 * Gets random cipher type for true unpredictability
 */
function getRandomCipher() {
  const randomIndex = Math.floor(Math.random() * CIPHER_TYPES.length);
  return CIPHER_TYPES[randomIndex];
}

/**
 * Gets random difficulty level (2-3 as requested)
 */
function getRandomDifficulty() {
  const difficulties = [2, 3];
  const randomIndex = Math.floor(Math.random() * difficulties.length);
  const selectedDifficulty = difficulties[randomIndex];
  logEvent('DEBUG', 'difficulty_selected', `Randomly selected difficulty: ${selectedDifficulty} (${DIFFICULTY_LEVELS[selectedDifficulty].description})`);
  return selectedDifficulty;
}

/**
 * Simple hash function for date strings
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

/**
 * Finds row by date in sheet
 */
function findRowByDate(sheet, date) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) { // Skip header row
    if (data[i][0] && data[i][0].toString() === date) {
      return i + 1; // Return 1-based row number
    }
  }
  
  return -1; // Not found
}

// ================================================
// SETUP AND UTILITY FUNCTIONS
// ================================================

/**
 * Sets up daily trigger for automatic puzzle generation
 */
function setupDailyTrigger() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'generateDailyPuzzleSequence') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new daily trigger at 1 AM
  ScriptApp.newTrigger('generateDailyPuzzleSequence')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
    
  logEvent('INFO', 'trigger_setup', 'Daily trigger created for 1 AM');
  console.log('✅ Daily trigger set up successfully');
}

/**
 * Web app endpoint for Landbot integration
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'get_puzzle') {
      return ContentService
        .createTextOutput(JSON.stringify(getTodaysPuzzleSequence()))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'update_usage') {
      const puzzleDate = e.parameter.date || Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      updateUsageCount(puzzleDate);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    logEvent('ERROR', 'web_app_error', `Web app request failed: ${error.toString()}`);
    return ContentService
      .createTextOutput(JSON.stringify({ error: 'Internal server error' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Gets today's puzzle sequence for API access
 */
function getTodaysPuzzleSequence() {
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
    
    if (!puzzleSheet) {
      logEvent('ERROR', 'get_today_puzzle_failed', 'Daily_Puzzles sheet not found');
      return { error: 'Database not available' };
    }
    
    const rowIndex = findRowByDate(puzzleSheet, today);
    if (rowIndex < 2) {
      // No puzzle for today - generate one
      logEvent('INFO', 'generating_missing_puzzle', `No puzzle found for ${today}, generating now`);
      createInitialPuzzle();
      
      // Try to find it again
      const newRowIndex = findRowByDate(puzzleSheet, today);
      if (newRowIndex < 2) {
        return { error: 'No puzzle available for today' };
      }
      
      const data = puzzleSheet.getRange(newRowIndex, 1, 1, 18).getValues()[0];
      return buildPuzzleResponse(data);
    }
    
    const data = puzzleSheet.getRange(rowIndex, 1, 1, 18).getValues()[0];
    return buildPuzzleResponse(data);
    
  } catch (error) {
    logEvent('ERROR', 'get_puzzle_error', `Error getting today's puzzle: ${error.toString()}`);
    return { error: 'Failed to retrieve puzzle' };
  }
}

/**
 * Helper function to build puzzle response
 */
function buildPuzzleResponse(data) {
  return {
    date: data[0],
    cipher_type: data[1],
    p1_answer: data[2],
    p1_encrypted_word: data[3],
    p1_hint1: data[4],
    p1_hint2: data[5],
    p1_hint3: data[6],
    p2_question: data[7],
    p2_hint1: data[8],
    p2_hint2: data[9],
    p2_hint3: data[10],
    p2_answer: data[11],
    p2_alt_answers: data[12],
    p3_answer: data[13],
    p3_hint: data[14]
  };
}

/**
 * Creates initial puzzle for today if none exists
 */
function createInitialPuzzle() {
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
    
    if (!puzzleSheet) {
      logEvent('ERROR', 'initial_puzzle_failed', 'Daily_Puzzles sheet not found');
      return { success: false, error: 'Sheet not found' };
    }
    
    // Generate puzzle for today
    const puzzleData = generatePuzzleWithGemini(today);
    
    if (!puzzleData) {
      logEvent('ERROR', 'initial_generation_failed', 'Failed to generate initial puzzle');
      return { success: false, error: 'Generation failed' };
    }
    
    // Add to sheet
    const newRow = puzzleSheet.getLastRow() + 1;
    puzzleSheet.getRange(newRow, 1, 1, 18).setValues([[
      today, puzzleData.cipher_type, puzzleData.p1_answer, puzzleData.p1_encrypted_word,
      puzzleData.p1_hint1, puzzleData.p1_hint2, puzzleData.p1_hint3,
      puzzleData.p2_question, puzzleData.p2_hint1, puzzleData.p2_hint2, puzzleData.p2_hint3,
      puzzleData.p2_answer, puzzleData.p2_alt_answers, puzzleData.p3_answer, puzzleData.p3_hint,
      puzzleData.generation_category, puzzleData.generation_difficulty, puzzleData.generation_timestamp
    ]]);
    
    // Update Current_Puzzle tab
    updateCurrentPuzzleTab(puzzleData);
    
    logEvent('SUCCESS', 'initial_puzzle_created', `Initial puzzle created for ${today}`);
    console.log(`✅ Initial puzzle created for ${today}`);
    
    return { success: true, puzzle: puzzleData };
    
  } catch (error) {
    logEvent('ERROR', 'initial_puzzle_error', `Error creating initial puzzle: ${error.toString()}`);
    return { success: false, error: error.toString() };
  }
}

/**
 * One-time setup function
 */
function initialSetup() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey) {
    logEvent('ERROR', 'setup_failed', 'GEMINI_API_KEY not found');
    console.log('❌ Please set GEMINI_API_KEY in Script Properties first');
    return { success: false, error: 'API key not configured' };
  }
  
  console.log('🚀 Starting initial setup...');
  
  // Create initial puzzle
  const result = createInitialPuzzle();
  if (!result.success) {
    console.log('❌ Initial setup failed: ' + result.error);
    return result;
  }
  
  // Set up daily automation
  setupDailyTrigger();
  
  console.log('✅ Initial setup complete!');
  console.log('✅ Daily automation enabled');
  console.log('✅ Today\'s puzzle generated');
  
  return { success: true };
}

/**
 * Updates usage count for a puzzle
 */
function updateUsageCount(puzzleDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const usageLog = ss.getSheetByName('Usage_Log');
    
    if (usageLog) {
      const timestamp = new Date().toISOString();
      usageLog.appendRow([timestamp, puzzleDate, 'completion']);
    }
    
    logEvent('INFO', 'usage_updated', `Usage recorded for ${puzzleDate}`);
    
  } catch (error) {
    logEvent('ERROR', 'usage_update_failed', `Failed to update usage: ${error.toString()}`);
  }
}

/**
 * Manual function to refresh today's puzzle (for testing)
 */
function refreshTodaysPuzzle() {
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  try {
    console.log(`🔄 Refreshing puzzle for ${today}...`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
    
    if (!puzzleSheet) {
      console.log('❌ Daily_Puzzles sheet not found');
      return;
    }
    
    // Remove existing puzzle for today if it exists
    const existingRow = findRowByDate(puzzleSheet, today);
    if (existingRow > 1) {
      puzzleSheet.deleteRow(existingRow);
      console.log(`🗑️ Removed existing puzzle from row ${existingRow}`);
    }
    
    // Generate new puzzle
    const result = createInitialPuzzle();
    if (result.success) {
      console.log(`✅ New puzzle generated for ${today}`);
    } else {
      console.log(`❌ Failed to generate new puzzle: ${result.error}`);
    }
    
  } catch (error) {
    console.log(`❌ Error refreshing puzzle: ${error.toString()}`);
    logEvent('ERROR', 'puzzle_refresh_failed', `Manual puzzle refresh failed: ${error.toString()}`);
  }
}