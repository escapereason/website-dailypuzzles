/**
 * Daily Cipher Challenge System - Beautifully Simple Version
 * 
 * Generates daily 3-puzzle cipher sequences: Decrypt → Trivia → Encrypt
 * Includes duplicate prevention and avoids company names per requirements
 * 
 * Setup:
 * 1. Set GEMINI_API_KEY in Script Properties
 * 2. Create Google Sheet with tabs: Daily_Puzzles, Current_Puzzle, System_Log
 * 3. Run initialSetup()
 * 
 * @version 3.0.0 - Beautiful Simplicity with Essential Features
 */

// ========================================
// CONFIGURATION
// ========================================

const CIPHER_TYPES = ['rot13', 'caesar_3', 'caesar_5', 'caesar_7', 'atbash'];

// Aligned with core puzzle themes and interactive experiences
const CATEGORIES = [
  'Space Exploration & Astronomy',
  'Robotics & Artificial Intelligence', 
  'Virtual Reality & Digital Worlds',
  'Biotechnology & Genetic Science',
  'Energy Systems & Physics'
];

// Future-tech terms most people know (aligned with universal puzzle themes)
const APPROVED_TERMS = [
  // Space Exploration (Moonshot, Mars colonies, ISS themes)
  'ROCKET', 'SATELLITE', 'PLASMA', 'LUNAR', 'SOLAR', 'COSMIC', 'ORBIT', 'GALAXY',
  'ASTEROID', 'NEUTRON', 'COMET', 'NEBULA', 'SHUTTLE', 'CAPSULE', 'CRATER', 'PROBE',
  
  // Technology & AI (Robotics, VR, holograms)  
  'ROBOT', 'DRONE', 'LASER', 'NEURAL', 'QUANTUM', 'DIGITAL', 'VIRTUAL', 'CYBER',
  'ALGORITHM', 'PROTOCOL', 'MATRIX', 'NETWORK', 'SYSTEM', 'INTERFACE', 'SENSOR', 'CIRCUIT',
  
  // Biotechnology (Genetic discovery themes)
  'GENOME', 'PROTEIN', 'ENZYME', 'CELLULAR', 'BIONIC', 'ORGANIC', 'GENETIC', 'MOLECULAR',
  'TISSUE', 'NEURAL', 'BIOTECH', 'SYNTHESIS', 'COMPOUND', 'ORGANISM', 'SPECIMEN', 'CULTURE',
  
  // Energy & Physics (Reactor, fusion themes)
  'FUSION', 'REACTOR', 'PHOTON', 'ELECTRON', 'ATOMIC', 'MAGNETIC', 'PARTICLE', 'ISOTOPE',
  'CRYSTAL', 'SPECTRUM', 'THERMAL', 'KINETIC', 'VOLTAGE', 'CURRENT', 'FIELD', 'WAVE'
];

// ========================================
// MAIN FUNCTIONS
// ========================================

/**
 * Daily puzzle generation - called automatically at 1 AM
 */
function generateDailyPuzzleSequence() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = Utilities.formatDate(tomorrow, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  
  // First check if GEMINI_API_KEY is configured
  if (!checkGeminiSetup()) {
    logEvent('ERROR', 'generation_failed', dateStr, 'GEMINI_API_KEY not properly configured in Script Properties');
    return;
  }
  
  // Skip if puzzle already exists
  if (findRowByDate(puzzleSheet, dateStr) > 0) {
    logEvent('INFO', 'generation_skipped', dateStr, 'puzzle already exists');
    return;
  }
  
  // Get recent answers for duplicate prevention
  const recentAnswers = getRecentAnswers(20); // Check last 20 puzzles
  
  try {
    // Try Gemini first
    const puzzleData = callGeminiForPuzzle(dateStr, recentAnswers);
    if (puzzleData && validatePuzzle(puzzleData, recentAnswers)) {
      savePuzzle(puzzleData, dateStr);
      logEvent('SUCCESS', 'generation_complete', dateStr, 'gemini_api');
      return;
    }
  } catch (error) {
    logEvent('WARNING', 'gemini_failed', dateStr, error.toString());
  }
  
  // Fallback system disabled per user request - log failure
  const fallback = getFallbackPuzzle(dateStr, recentAnswers);
  if (!fallback) {
    logEvent('ERROR', 'generation_failed', dateStr, 'Both Gemini and fallback systems unavailable');
    return;
  }
  savePuzzle(fallback, dateStr);
  logEvent('SUCCESS', 'generation_complete', dateStr, 'fallback');
}

/**
 * Get recent answers for duplicate prevention
 */
function getRecentAnswers(lookbackCount = 20) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Daily_Puzzles');
  
  if (!sheet) return new Set();
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return new Set();
  
  const recentAnswers = new Set();
  const startRow = Math.max(1, data.length - lookbackCount);
  
  for (let i = startRow; i < data.length; i++) {
    if (data[i][2]) recentAnswers.add(data[i][2].toString().toUpperCase().trim()); // p1_answer
    if (data[i][11]) recentAnswers.add(data[i][11].toString().toUpperCase().trim()); // p2_answer
  }
  
  return recentAnswers;
}

/**
 * Call Gemini API for puzzle generation
 */
function callGeminiForPuzzle(dateStr, recentAnswers) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY not found');
  
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const cipherType = CIPHER_TYPES[Math.floor(Math.random() * CIPHER_TYPES.length)];
  
  // Create exclusion text for duplicate prevention
  const exclusionText = recentAnswers.size > 0 ? 
    `\n\nCRITICAL: DO NOT use these recent answers: ${Array.from(recentAnswers).slice(0, 10).join(', ')}` : '';
  
  const prompt = `Create a future-tech cipher sequence for ${dateStr} using ${cipherType} cipher - humanizing our relationship with technology through collaborative discovery:${exclusionText}

PUZZLE DESIGN PRINCIPLES:
- Focus on frontier technologies that transform human experience
- Emphasize collaborative problem-solving and exploration themes  
- Use future-tech concepts familiar to general audiences
- Channel space exploration, robotics, VR, biotechnology, and energy systems
- NO company names - focus on scientific/technological concepts

APPROVED FUTURE-TECH TERMS:
- Space: ROCKET, SATELLITE, PLASMA, LUNAR, SOLAR, COSMIC, ORBIT, GALAXY, NEUTRON
- Robotics/AI: ROBOT, DRONE, LASER, NEURAL, QUANTUM, DIGITAL, VIRTUAL, CYBER, ALGORITHM  
- Biotech: GENOME, PROTEIN, ENZYME, CELLULAR, BIONIC, ORGANIC, MOLECULAR, SYNTHESIS
- Energy: FUSION, REACTOR, PHOTON, ELECTRON, ATOMIC, MAGNETIC, PARTICLE, SPECTRUM

CIPHER SYSTEMS:
- rot13: shift 13 (A→N) - "ancient encryption meets future tech"
- caesar_3: shift 3 (A→D) - "classic cipher for modern discovery"  
- caesar_5: shift 5 (A→F) - "intermediate complexity for collaborative solving"
- caesar_7: shift 7 (A→H) - "advanced shift for frontier exploration"
- atbash: reverse alphabet (A→Z) - "mirror universe encryption"

STRUCTURE - 3-Puzzle Discovery Sequence:
1. Decrypt a future-tech term → collaborative code-breaking
2. Answer discovery trivia about DIFFERENT future-tech concept → knowledge sharing  
3. Encrypt the discovery → applying learned cipher mastery

EXAMPLE:
{
  "cipher_type": "caesar_7",
  "p1_answer": "QUANTUM",
  "p1_encrypted_word": "XBHUABZ", 
  "p1_hint1": "This encryption method has protected secrets throughout history",
  "p1_hint2": "This is a Caesar cipher - each letter shifts forward",
  "p1_hint3": "Every letter advances exactly 7 positions in the alphabet",
  "p2_question": "What fourth state of matter powers fusion reactors and forms in stars?",
  "p2_hint1": "This superheated state exists at millions of degrees",
  "p2_hint2": "Contains free electrons and ions in electromagnetic fields",
  "p2_hint3": "Essential for controlled fusion energy and space propulsion",
  "p2_answer": "PLASMA",
  "p2_alt_answers": "PLASMA,PLASMA STATE,FOURTH STATE",
  "p3_answer": "WSHZTH",
  "p3_hint": "Apply the same 7-position advancement from your first discovery",
  "category": "${category}"
}

REQUIREMENTS:
- p1_answer and p2_answer must be DIFFERENT future-tech terms
- All content inspires technological curiosity and collaboration
- Accessible to SF Bay Area tech community without being overly technical
- Trivia should teach something fascinating about frontier technology

Generate ONLY the JSON:`;

  const response = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
      muteHttpExceptions: true
    }
  );
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`API Error: ${response.getResponseCode()}`);
  }
  
  const data = JSON.parse(response.getContentText());
  const content = data.candidates[0].content.parts[0].text;
  const cleanJson = content.replace(/```json|```/g, '').trim();
  
  return JSON.parse(cleanJson);
}

/**
 * Validate puzzle data (encryption accuracy + no duplicates)
 */
function validatePuzzle(puzzle, recentAnswers) {
  if (!puzzle.p1_answer || !puzzle.p2_answer || !puzzle.cipher_type) {
    logEvent('WARNING', 'validation_failed', null, 'Missing required puzzle fields');
    return false;
  }
  
  if (puzzle.p1_answer === puzzle.p2_answer) {
    logEvent('WARNING', 'validation_failed', null, 'p1_answer and p2_answer are identical');
    return false;
  }
  
  // Check for recent duplicates
  const p1Upper = puzzle.p1_answer.toUpperCase().trim();
  const p2Upper = puzzle.p2_answer.toUpperCase().trim();
  if (recentAnswers.has(p1Upper) || recentAnswers.has(p2Upper)) {
    logEvent('WARNING', 'validation_failed', null, `Duplicate answers found: ${p1Upper} or ${p2Upper}`);
    return false;
  }
  
  // Check encryption accuracy
  const expectedP1 = applyCipher(puzzle.p1_answer, puzzle.cipher_type);
  const expectedP3 = applyCipher(puzzle.p2_answer, puzzle.cipher_type);
  
  const p1Valid = puzzle.p1_encrypted_word === expectedP1;
  const p3Valid = puzzle.p3_answer === expectedP3;
  
  if (!p1Valid || !p3Valid) {
    logEvent('WARNING', 'validation_failed', null, 
      `Encryption validation failed. P1: got "${puzzle.p1_encrypted_word}" expected "${expectedP1}" (${p1Valid}). P3: got "${puzzle.p3_answer}" expected "${expectedP3}" (${p3Valid})`);
    return false;
  }
  
  logEvent('SUCCESS', 'validation_passed', null, 'Puzzle validation successful');
  return true;
}

/**
 * Apply cipher encryption
 */
function applyCipher(word, cipherType) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  
  for (let char of word.toUpperCase()) {
    if (!alphabet.includes(char)) {
      result += char;
      continue;
    }
    
    const index = alphabet.indexOf(char);
    let newIndex;
    
    switch (cipherType) {
      case 'rot13': newIndex = (index + 13) % 26; break;
      case 'caesar_3': newIndex = (index + 3) % 26; break;
      case 'caesar_5': newIndex = (index + 5) % 26; break;
      case 'caesar_7': newIndex = (index + 7) % 26; break;
      case 'atbash': newIndex = 25 - index; break;
      default: newIndex = index;
    }
    
    result += alphabet[newIndex];
  }
  
  return result;
}

/**
 * Emergency fallback - basic term selection only (no hardcoded content per user request)
 */
function getFallbackPuzzle(dateStr, recentAnswers) {
  // Return null to indicate fallback system is disabled
  // System should rely entirely on Gemini generation
  return null;
}

/**
 * Save puzzle to sheets (20 columns for Daily_Puzzles, 15 for Current_Puzzle)
 */
function savePuzzle(puzzleData, dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Save to Daily_Puzzles (20 columns A-T)
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  const newRow = puzzleSheet.getLastRow() + 1;
  puzzleSheet.getRange(newRow, 1, 1, 20).setValues([[
    dateStr,                           // A: date
    puzzleData.cipher_type,            // B: cipher_type
    puzzleData.p1_answer,              // C: p1_answer
    puzzleData.p1_encrypted_word,      // D: p1_encrypted_word
    puzzleData.p1_hint1,               // E: p1_hint1
    puzzleData.p1_hint2,               // F: p1_hint2  
    puzzleData.p1_hint3,               // G: p1_hint3
    puzzleData.p2_question,            // H: p2_question
    puzzleData.p2_hint1,               // I: p2_hint1
    puzzleData.p2_hint2,               // J: p2_hint2
    puzzleData.p2_hint3,               // K: p2_hint3
    puzzleData.p2_answer,              // L: p2_answer
    puzzleData.p2_alt_answers,         // M: p2_alt_answers
    puzzleData.p3_answer,              // N: p3_answer
    puzzleData.p3_hint,                // O: p3_hint
    puzzleData.category,               // P: category
    3,                                 // Q: difficulty
    'auto',                            // R: source
    true,                              // S: validated
    0                                  // T: usage_count
  ]]);
  
  // Update Current_Puzzle for today's puzzle
  updateCurrentPuzzle();
}

/**
 * Update Current_Puzzle tab with today's data (15 columns A-O)
 */
function updateCurrentPuzzle() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  const currentSheet = ss.getSheetByName('Current_Puzzle');
  
  const today = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');  
  const row = findRowByDate(puzzleSheet, today);
  
  if (row > 0) {
    const data = puzzleSheet.getRange(row, 2, 1, 15).getValues()[0]; // Skip date column, get B-P
    currentSheet.getRange(2, 1, 1, 15).setValues([data]);
  }
}

// ========================================
// UTILITY FUNCTIONS  
// ========================================

function findRowByDate(sheet, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === date) return i + 1;
  }
  return 0;
}

function logEvent(level, eventType, puzzleDate, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('System_Log');
  if (!logSheet) return;
  
  const newRow = logSheet.getLastRow() + 1;
  logSheet.getRange(newRow, 1, 1, 5).setValues([[
    new Date(), level, eventType, puzzleDate || '', details
  ]]);
}

// ========================================
// SETUP FUNCTIONS
// ========================================

function setupDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));
  
  ScriptApp.newTrigger('generateDailyPuzzleSequence')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
    
  logEvent('INFO', 'trigger_setup', null, 'Daily trigger created for 1 AM');
}

function createInitialPuzzle() {
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  
  // Try Gemini first for initial puzzle
  try {
    const recentAnswers = getRecentAnswers(20);
    const puzzleData = callGeminiForPuzzle(today, recentAnswers);
    if (puzzleData && validatePuzzle(puzzleData, recentAnswers)) {
      savePuzzle(puzzleData, today);
      logEvent('INFO', 'initial_puzzle', today, 'Created initial puzzle via Gemini');
      return;
    }
  } catch (error) {
    logEvent('WARNING', 'initial_gemini_failed', today, error.toString());
  }
  
  // Fallback disabled - log failure
  logEvent('ERROR', 'initial_puzzle_failed', today, 'Unable to create initial puzzle - Gemini generation required');
}

function initialSetup() {
  setupDailyTrigger();
  createInitialPuzzle();
  updateCurrentPuzzle();
  logEvent('INFO', 'system_setup', null, 'Initial setup complete');
}

// ========================================
// WEB APP FUNCTIONS
// ========================================

function doGet(e) {
  const action = e.parameter.action;
  
  if (action === 'today') {
    return ContentService
      .createTextOutput(JSON.stringify(getTodaysPuzzle()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput('Daily Cipher Challenge API');
}

function getTodaysPuzzle() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentSheet = ss.getSheetByName('Current_Puzzle');
  const data = currentSheet.getRange(2, 1, 1, 15).getValues()[0];
  
  return {
    cipher_type: data[0],
    p1_answer: data[1],
    p1_encrypted_word: data[2],
    p1_hint1: data[3],
    p1_hint2: data[4],
    p1_hint3: data[5],
    p2_question: data[6],
    p2_hint1: data[7],
    p2_hint2: data[8],
    p2_hint3: data[9],
    p2_answer: data[10],
    p2_alt_answers: data[11],
    p3_answer: data[12],
    p3_hint: data[13],
    category: data[14]
  };
}

// ========================================
// TESTING FUNCTIONS
// ========================================

/**
 * Check if GEMINI_API_KEY is properly configured
 */
function checkGeminiSetup() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  
  if (!apiKey) {
    logEvent('ERROR', 'setup_check', null, 'GEMINI_API_KEY not found in Script Properties');
    return false;
  }
  
  if (!apiKey.startsWith('AIza')) {
    logEvent('ERROR', 'setup_check', null, 'GEMINI_API_KEY format appears invalid (should start with AIza)');
    return false;
  }
  
  logEvent('INFO', 'setup_check', null, 'GEMINI_API_KEY configured correctly');
  return true;
}

/**
 * Test our cipher implementations to ensure they work correctly
 */
function testCipherImplementations() {
  const testCases = [
    { word: 'NEURAL', cipher: 'rot13', expected: 'ARHENY' },
    { word: 'SYNTHESIS', cipher: 'rot13', expected: 'FLAGUREVF' },
    { word: 'HELLO', cipher: 'caesar_3', expected: 'KHOOR' },
    { word: 'WORLD', cipher: 'caesar_5', expected: 'BTWQI' },
    { word: 'TEST', cipher: 'atbash', expected: 'GVHG' }
  ];
  
  let allPassed = true;
  
  testCases.forEach(test => {
    const result = applyCipher(test.word, test.cipher);
    const passed = result === test.expected;
    
    logEvent(passed ? 'SUCCESS' : 'ERROR', 'cipher_test', null, 
      `${test.cipher}: "${test.word}" -> "${result}" (expected "${test.expected}") - ${passed ? 'PASS' : 'FAIL'}`);
    
    if (!passed) allPassed = false;
  });
  
  logEvent(allPassed ? 'SUCCESS' : 'ERROR', 'cipher_test_complete', null, 
    `Cipher implementation test ${allPassed ? 'PASSED' : 'FAILED'}`);
}

/**
 * Test Gemini API with simple request to verify connectivity
 */
function testGeminiAPI() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    logEvent('ERROR', 'api_test', null, 'GEMINI_API_KEY not found');
    return;
  }
  
  const testPrompt = 'Say "Hello, I am working!" and nothing else.';
  
  try {
    const response = UrlFetchApp.fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: [{ text: testPrompt }] }]
        }),
        muteHttpExceptions: true
      }
    );
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    logEvent('INFO', 'api_test', null, 
      `Gemini API test - Response Code: ${responseCode}, Response: ${responseText.substring(0, 200)}`);
    
    if (responseCode === 200) {
      const data = JSON.parse(responseText);
      const content = data.candidates[0].content.parts[0].text;
      logEvent('SUCCESS', 'api_test', null, `Gemini API working - Response: ${content}`);
    } else {
      logEvent('ERROR', 'api_test', null, `Gemini API failed - Code: ${responseCode}, Response: ${responseText}`);
    }
    
  } catch (error) {
    logEvent('ERROR', 'api_test', null, `Gemini API test error: ${error.toString()}`);
  }
}

/**
 * Refresh today's puzzle - generates new puzzle for current date
 * Useful for testing or if you want a fresh puzzle for today
 */
function refreshToday() {
  const today = Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  const ss = SpreadsheetApp.getActiveSpreadsheet();  
  const puzzleSheet = ss.getSheetByName('Daily_Puzzles');
  
  // First check if GEMINI_API_KEY is configured
  if (!checkGeminiSetup()) {
    logEvent('ERROR', 'refresh_failed', today, 'GEMINI_API_KEY not properly configured in Script Properties');
    return;
  }
  
  // Remove existing puzzle for today if it exists
  const existingRow = findRowByDate(puzzleSheet, today);
  if (existingRow > 0) {
    puzzleSheet.deleteRow(existingRow);
    logEvent('INFO', 'puzzle_refreshed', today, 'Deleted existing puzzle for refresh');
  }
  
  // Get recent answers for duplicate prevention  
  const recentAnswers = getRecentAnswers(20);
  
  try {
    // Try Gemini first
    const puzzleData = callGeminiForPuzzle(today, recentAnswers);
    if (puzzleData && validatePuzzle(puzzleData, recentAnswers)) {
      savePuzzle(puzzleData, today);
      logEvent('SUCCESS', 'refresh_complete', today, 'gemini_api');
      return;
    } else {
      logEvent('WARNING', 'refresh_gemini_validation_failed', today, 
        `Gemini returned data but validation failed. Data: ${JSON.stringify(puzzleData)}`);
    }
  } catch (error) {
    logEvent('ERROR', 'refresh_gemini_api_error', today, 
      `Gemini API call failed: ${error.toString()}. Stack: ${error.stack || 'No stack trace'}`);
  }
  
  // Fallback system disabled - log failure  
  const fallback = getFallbackPuzzle(today, recentAnswers);
  if (!fallback) {
    logEvent('ERROR', 'refresh_failed', today, 'Unable to refresh puzzle - Gemini generation required');
    return;
  }
  savePuzzle(fallback, today);
  logEvent('SUCCESS', 'refresh_complete', today, 'fallback');
}