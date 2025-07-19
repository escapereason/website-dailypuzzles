# AI Prompt for WordPress Plugin Code Generation

## Master Prompt for AI Code Generation

```
You are an expert WordPress plugin developer. Create a complete WordPress plugin for daily tech trivia with the following specifications:

**PLUGIN REQUIREMENTS:**
- Plugin Name: "Daily Tech Trivia"
- Single file WordPress plugin
- Automatically generates daily tech trivia using OpenAI API
- Stores trivia in WordPress database
- Displays trivia via shortcode [tech_trivia]
- Admin settings page for configuration

**CORE FUNCTIONALITY:**
1. **Daily Cron Job**: Calls OpenAI API once per day to generate trivia
2. **Database Storage**: Creates custom table to store trivia questions
3. **Shortcode Display**: Shows today's trivia question with answer input
4. **Admin Interface**: Settings page for API key and configuration
5. **Answer Validation**: Checks user answers (case-insensitive, flexible matching)

**DATABASE SCHEMA:**
Table: wp_daily_trivia
- id (auto increment)
- trivia_date (DATE, unique)
- question (TEXT)
- answer (VARCHAR 255)
- category (VARCHAR 100)
- difficulty (INT 1-5)
- created_at (TIMESTAMP)

**OPENAI INTEGRATION:**
- Use ChatGPT API (gpt-3.5-turbo)
- Generate tech trivia suitable for software engineers
- Return JSON format: {question, answer, category, difficulty}
- Handle API errors gracefully with fallbacks

**FRONTEND DISPLAY:**
- Clean, responsive design
- Question display
- Text input for answer
- Submit button with AJAX validation
- Success/failure feedback
- "Come back tomorrow" message after solving

**ADMIN INTERFACE:**
WordPress Settings page with:
- Google Gemini API key input (encrypted storage)
- Daily generation time setting
- Manual generation button
- View recent trivia questions
- Basic statistics

**ERROR HANDLING:**
- API failure fallbacks
- Duplicate date prevention
- Input sanitization
- Graceful degradation

**SECURITY:**
- Nonce verification for AJAX
- Input sanitization
- Capability checks for admin functions
- Encrypted API key storage

**CODE STRUCTURE:**
Create as single PHP file with classes:
- Main plugin class
- Database handler
- OpenAI API integration
- Admin interface
- Frontend display
- AJAX handlers

**STYLING:**
Include basic CSS for:
- Clean trivia widget appearance
- Mobile responsive design
- Success/error message styling
- Admin interface styling

**CRON IMPLEMENTATION:**
- WordPress wp_cron for daily generation
- Scheduled for 2 AM daily
- Proper cron cleanup on plugin deactivation

**SAMPLE GEMINI PROMPT TO USE:**
"Generate tech trivia for software engineers. Return JSON with: question (clear, factual), answer (concise), category (Programming/Cloud/Security/etc), difficulty (1-5). Example: {'question': 'What does API stand for?', 'answer': 'Application Programming Interface', 'category': 'Programming Basics', 'difficulty': 2}"

**FILE STRUCTURE:**
daily-tech-trivia/
├── daily-tech-trivia.php (main plugin file)
├── readme.txt (WordPress plugin readme)
└── css/style.css (basic styling)

**WORDPRESS STANDARDS:**
- Follow WordPress coding standards
- Proper plugin headers
- Activation/deactivation hooks
- Uninstall cleanup

**TESTING REQUIREMENTS:**
- Works with latest WordPress version
- No PHP errors or warnings
- Proper database table creation
- AJAX functionality works
- Cron job executes correctly

Generate the complete plugin code following these specifications. Include all necessary files and comprehensive error handling.
```

## Usage Instructions

### For AI Code Generation (ChatGPT/Claude)
1. **Copy the entire prompt above**
2. **Paste into ChatGPT-4 or Claude**
3. **AI will generate complete WordPress plugin code**
4. **Save the generated files**
5. **Test on staging site first**

### For Human Developer
1. **Give developer the prompt as specification**
2. **They can follow it as a detailed blueprint**
3. **Request they include all specified features**
4. **Ask for testing on staging environment**

## Expected Output from AI

The AI should generate:
- `daily-tech-trivia.php` (main plugin file, ~500-800 lines)
- `readme.txt` (WordPress plugin documentation)
- `css/style.css` (basic styling)
- Installation instructions
- Testing checklist

## Quality Validation

### Check Generated Code Has:
- [ ] Proper WordPress plugin headers
- [ ] Database table creation on activation
- [ ] OpenAI API integration with error handling
- [ ] WordPress cron job setup
- [ ] Admin settings page
- [ ] Shortcode registration and display
- [ ] AJAX answer validation
- [ ] Security measures (nonces, sanitization)
- [ ] Uninstall cleanup

### Test Generated Plugin:
- [ ] Activates without errors
- [ ] Creates database table
- [ ] Settings page appears in admin
- [ ] Can save API key
- [ ] Manual generation works
- [ ] Shortcode displays trivia
- [ ] Answer submission works
- [ ] Cron job scheduled properly

## Customization Instructions

### To Modify Generated Code:
```php
// Change generation time (in plugin file)
$schedule_time = '03:00'; // Change from 2 AM to 3 AM

// Modify trivia categories
$categories = ['Programming', 'Cloud', 'AI/ML', 'Security', 'Hardware'];

// Adjust difficulty scaling
$difficulty = min(5, max(1, (date('j') % 5) + 1));

// Customize styling (in CSS file)
.tech-trivia-widget { 
    /* Add your brand colors */
    border: 2px solid #your-brand-color;
}
```

This prompt will generate a complete, functional WordPress plugin that meets all your requirements!