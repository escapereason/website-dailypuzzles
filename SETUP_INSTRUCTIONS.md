# Daily Cipher Challenge - Complete Setup Guide

## 📋 Overview
This guide will help you set up the simplified Daily Cipher Challenge system with reliable Gemini AI puzzle generation, Google Sheets storage, and Landbot integration. This version focuses on making Gemini work consistently instead of relying on fallback systems.

## 🔧 Prerequisites
- Google Account with access to Google Sheets and Apps Script
- Gemini API key from [Google AI Studio](https://aistudio.google.com/)
- Landbot account

## 📊 Step 1: Create Google Sheet Structure

### 1.1 Create New Google Sheet
1. Go to [sheets.google.com](https://sheets.google.com)
2. Create a new sheet named: **"Daily Cipher Challenges Database"**

### 1.2 Set Up Sheet Tabs
Create 4 tabs with these exact names:
- `Daily_Puzzles`
- `Current_Puzzle` 
- `Usage_Log`
- `System_Log`

### 1.3 Import CSV Data

**For Daily_Puzzles tab:**
1. Select the `Daily_Puzzles` tab
2. Go to File → Import → Upload
3. Upload `GoogleSheets_Template_Daily_Puzzles.csv`
4. Choose "Replace current sheet" and "Yes" to convert text to numbers/dates

**For Usage_Log tab:**
1. Select the `Usage_Log` tab  
2. Import `GoogleSheets_Template_Usage_Log.csv`

**For System_Log tab:**
1. Select the `System_Log` tab
2. Import `GoogleSheets_Template_System_Log.csv`

**For Current_Puzzle tab:**
1. Select the `Current_Puzzle` tab
2. Import `GoogleSheets_Template_Current_Puzzle.csv`

### 1.4 Important Note About Current_Puzzle Tab
The `Current_Puzzle` tab will be automatically populated by the Apps Script when you run the initial setup. This tab always contains row 2 with today's puzzle data for easy Landbot integration.

## ⚙️ Step 2: Set Up Google Apps Script

### 2.1 Access Apps Script
1. In your Google Sheet, go to **Extensions → Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `DailyCipherChallenge.gs` and paste it

### 2.2 Configure API Key
1. Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. In Apps Script, click the gear icon (⚙️ Project Settings)
3. Scroll down to "Script Properties" section
4. Click "Add script property"
5. Property: `GEMINI_API_KEY` (exactly as shown)
6. Value: Paste your API key (starts with "AIza...")
7. Click "Save script properties"

### 2.3 Set Permissions
1. Click "Run" on the `initialSetup` function
2. Grant permissions when prompted
3. The function will:
   - Create your first puzzle using Gemini AI
   - Set up daily automation
   - Test the simplified system

### 2.4 Deploy Web App (for Landbot integration)
1. Click "Deploy → New deployment"
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Click "Deploy"
6. **Copy the Web App URL** - you'll need this for Landbot

## 🤖 Step 3: Set Up Landbot Integration

### 3.1 Connect to Google Sheets
1. In Landbot, go to Integrations
2. Add Google Sheets integration
3. Connect to your "Daily Cipher Challenges Database" sheet
4. Select the `Current_Puzzle` tab

### 3.2 Create Variables
Create these variables in Landbot and map them to the Current_Puzzle row 2 cells:

| Variable | Current_Puzzle Cell | Purpose |
|----------|-------------------|---------|
| `@cipher_type` | A2 | Cipher method |
| `@p1_answer` | B2 | Correct decrypted word |
| `@p1_encrypted_word` | C2 | Word to decrypt |
| `@p1_hint1` | D2 | Historical cipher context |
| `@p1_hint2` | E2 | Cipher type name |
| `@p1_hint3` | F2 | Exact parameter/shift |
| `@p2_question` | G2 | Codeword generation question |
| `@p2_hint1` | H2 | First codeword hint |
| `@p2_hint2` | I2 | Second codeword hint |
| `@p2_hint3` | J2 | Final codeword hint |
| `@p2_answer` | K2 | Codeword answer |
| `@p2_alt_answers` | L2 | Alternative answers |
| `@p3_answer` | M2 | Encrypted result |
| `@p3_hint` | N2 | Encryption hint |
| `@category` | O2 | Puzzle category |

### 3.3 Create Session Variables
Add these for tracking user progress:
- `@current_puzzle` (1, 2, or 3)
- `@user_input` (user responses)
- `@attempt_count_p1` (decrypt attempts)
- `@attempt_count_p2` (codeword generation attempts)
- `@attempt_count_p3` (encrypt attempts)
- `@hints_used_p1` (cipher hints used: 0-3)
- `@hints_used_p2` (codeword hints used: 0-3)

## 🔄 Step 4: Build Landbot Flow

**⚠️ IMPORTANT:** For complete Landbot implementation details, see `LANDBOT_IMPLEMENTATION_GUIDE.md`

### 4.1 Quick Flow Overview
The Landbot implementation uses **Formulas blocks** with the `Upper()` function for reliable text comparison:

1. **Text Block** - Welcome & puzzle presentation
2. **Question Block** - Get user input
3. **Formulas Block** - Convert to uppercase: `Upper(@user_input)`
4. **Conditions Block** - Validate answers with uppercase comparison
5. **Set Variable Block** - Track attempts and progress

### 4.2 Key Implementation Notes

**Requires Professional/Business Plan** for Formulas block access.

**Use Formulas Block for Text Comparison:**
```
Formula: Upper(@user_input)
Output: @user_input_upper
```

**Then in Conditions:**
```
IF @user_input_upper equals @p1_answer_upper
   → Success path
```

See `LANDBOT_IMPLEMENTATION_GUIDE.md` for complete step-by-step implementation with all block types, formulas, and validation logic.

## 🧪 Step 5: Testing

### 5.1 Test Apps Script
1. In Apps Script, run `refreshTodaysPuzzle()` to generate and verify today's puzzle
2. Run `createInitialPuzzle()` if you need to set up initial data
3. Check your Daily_Puzzles tab for data
4. Verify Current_Puzzle tab row 2 shows today's puzzle

### 5.2 Test Landbot
1. **Verify Current_Puzzle data**: Check that row 2 has puzzle data
2. **Test variable mapping**: Ensure @p1_encrypted_word shows the encrypted word
3. **Preview your Landbot flow**: Try the complete 3-puzzle sequence
4. **Test correct answers**: Verify decryption → trivia → encryption flow
5. **Test hint system**: Check all 3 puzzle hint types work
6. **Test alternative answers**: Verify trivia alternative matching
7. **Test error scenarios**: Wrong answers, max attempts, empty responses

### 5.3 Test Daily Generation
1. In Apps Script, manually run `generateDailyPuzzleSequence()`
2. Check System_Log for generation events
3. Verify new puzzle appears in Daily_Puzzles
4. Confirm Current_Puzzle tab updates automatically

## 📊 Step 6: Analytics & Monitoring

### 6.1 Usage Tracking
- Landbot can call your Web App URL with `?action=update_usage` to increment usage counts
- Usage_Log tracks individual session data
- System_Log tracks technical events

### 6.2 Error Monitoring
- Check System_Log daily for generation errors
- Monitor Gemini API quota usage
- Review fallback puzzle usage frequency

## 🔧 Troubleshooting

### Common Issues

**"No puzzle for today" in Landbot:**
- Check Daily_Puzzles tab has today's date
- Verify Current_Puzzle tab row 2 has data
- Run `createInitialPuzzle()` if needed

**Daily generation not working:**
- Check if `setupDailyTrigger()` was run
- Verify GEMINI_API_KEY is set correctly
- Check System_Log for error details

**Landbot showing errors:**
- Verify all variables are mapped to Current_Puzzle row 2 cells
- Check Google Sheets integration is connected
- Test Current_Puzzle data manually

**Cipher validation failing:**
- Check System_Log for specific error messages
- Verify puzzle data in Daily_Puzzles tab
- Test `applyCipher()` function manually

## 🎯 Success Metrics

Once running, monitor these KPIs:
- Daily puzzle generation success rate: >99%
- User completion rate: >60%
- Average hints used per session: 1.5-2.0
- System uptime: >99.9%

## 🔄 Maintenance

### Daily
- Verify new puzzle generated automatically
- Check System_Log for any errors

### Weekly  
- Review Gemini API usage (stay under quotas)
- Analyze user engagement in Usage_Log
- Monitor Gemini API reliability metrics

### Monthly
- Review puzzle quality and difficulty balance
- Update cipher types or categories if desired
- Backup all data

---

🎉 **Setup Complete!** Your Daily Cipher Challenge system is now ready for automated operation.

For support or questions, refer to the system logs and test functions provided in the Apps Script.