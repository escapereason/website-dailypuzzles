# Daily Cipher Challenge - Quick Reference

## 📁 Files Overview

| File | Purpose |
|------|---------|
| `DailyCipherChallenge.gs` | Complete Apps Script code - copy/paste into Google Apps Script |
| `GoogleSheets_Template_Daily_Puzzles.csv` | Headers for main puzzle data tab |
| `GoogleSheets_Template_Current_Puzzle.csv` | Headers for Landbot integration tab |
| `GoogleSheets_Template_Usage_Log.csv` | Headers for user analytics tab |
| `GoogleSheets_Template_System_Log.csv` | Headers for technical monitoring tab |
| `SETUP_INSTRUCTIONS.md` | Complete step-by-step setup guide |

## ⚡ Quick Setup Checklist

- [ ] Create Google Sheet with 4 tabs
- [ ] Import CSV files for structure
- [ ] Copy Apps Script code and set GEMINI_API_KEY
- [ ] Run `initialSetup()` function
- [ ] Deploy as Web App for Landbot
- [ ] Connect Landbot to Current_Puzzle tab row 2
- [ ] Test complete flow

## 🔧 Key Functions in Apps Script

| Function | Purpose | When to Run |
|----------|---------|-------------|
| `initialSetup()` | Complete first-time setup | Once after installation |
| `setupDailyTrigger()` | Enable daily automation | Once after installation |
| `createInitialPuzzle()` | Add today's puzzle | Once to get started |
| `generateDailyPuzzleSequence()` | Generate tomorrow's puzzle | Automatically daily at 1 AM |
| `refreshTodaysPuzzle()` | Refresh today's puzzle with new content | For testing/troubleshooting |

## 🎯 Landbot Variable Mapping

**Data Variables (Current_Puzzle tab row 2):**
- `@cipher_type` → A2
- `@p1_answer` → B2  
- `@p1_encrypted_word` → C2
- `@p1_hint1` → D2 (Historical context)
- `@p1_hint2` → E2 (Cipher type)
- `@p1_hint3` → F2 (Exact parameter)
- `@p2_question` → G2
- `@p2_hint1` → H2
- `@p2_hint2` → I2
- `@p2_hint3` → J2
- `@p2_answer` → K2
- `@p2_alt_answers` → L2
- `@p3_answer` → M2
- `@p3_hint` → N2
- `@category` → O2

**Session Variables:**
- `@current_puzzle` (1, 2, 3)
- `@attempt_count_p1`, `@attempt_count_p2`, `@attempt_count_p3`
- `@hints_used_p1` (0-3) - Progressive cipher hints
- `@hints_used_p2` (0-3) - Codeword generation hints
- `@user_input`

## 🔄 Daily Flow Overview

```
1 AM: Apps Script generates tomorrow's puzzle → Daily_Puzzles + Current_Puzzle tabs
Anytime: User accesses Landbot → Current_Puzzle row 2 → Today's puzzle
User completion: Optional Web App call → Updates usage_count
```

## 📊 Google Sheet Structure

**4 Tabs Required:**
1. **Daily_Puzzles** - Main data (15 columns A-O)
2. **Current_Puzzle** - Today's puzzle for Landbot (15 columns A-O, row 2)
3. **Usage_Log** - User analytics (3 columns)
4. **System_Log** - Technical monitoring (4 columns)

## 🚨 Troubleshooting Quick Fixes

**No puzzle today:**
```javascript
createInitialPuzzle()
```

**Daily generation stopped:**
```javascript
setupDailyTrigger()
```

**Refresh today's puzzle:**
```javascript
refreshTodaysPuzzle()
```

**Manual puzzle generation:**
```javascript
generateDailyPuzzleSequence()
```

## 🔐 Cipher Types Available

| Type | Difficulty | Example |
|------|------------|---------|
| `rot13` | 1 | A→N, HELLO→URYYB |
| `atbash` | 1 | A→Z, HELLO→SVOOL |
| `caesar_3` | 2 | A→D, HELLO→KHOOR |
| `caesar_5` | 3 | A→F, HELLO→MJQQT |
| `caesar_7` | 3 | A→H, HELLO→OLSSV |
| `caesar_11` | 3 | A→L, HELLO→SVOOL |
| `caesar_neg3` | 4 | A→X, HELLO→EBIIL |
| `caesar_neg5` | 4 | A→V, HELLO→CZGGJ |

## 📝 Required API Key

Get Gemini API key from: https://aistudio.google.com/
Store in Apps Script: Project Settings → Script Properties → `GEMINI_API_KEY`

## 🎯 Success Indicators

- ✅ Current_Puzzle row 2 shows today's puzzle data (not fallback)
- ✅ Daily_Puzzles has new rows each day
- ✅ System_Log shows successful generation events
- ✅ Landbot flow works end-to-end
- ✅ Usage tracking increments when puzzles completed

---

For detailed instructions, see `SETUP_INSTRUCTIONS.md`