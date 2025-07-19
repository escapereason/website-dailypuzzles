# WordPress Daily Tech Trivia - ULTRA SIMPLE Requirements

## Project Overview
Create a WordPress plugin that automatically generates daily tech trivia using AI, stores it in the WordPress database, and pushes a copy to a Google Sheet.

## Core Requirements

### What It Does
- Calls OpenAI API once daily at 2 AM
- Generates tech trivia question + answer
- Stores in WordPress database for fast website performance
- Pushes the same data to a Google Sheet for easy logging and management
- Displays today's trivia on the website via a shortcode
- Users can guess the answer as many times as they like, with a visible guess counter

### What You Need to Provide
- Google Gemini API key
- WordPress admin access for installation
- Google Cloud account for API access (to connect to Google Sheets)

---

## Technical Structure

### Single Plugin File
```
daily-tech-trivia/
├── daily-tech-trivia.php    // Everything in one file (~300 lines)
├── style.css                // Basic styling
└── README.txt               // Installation instructions
```

### WordPress Database Tables (Auto-Created)
**wp_daily_trivia** (WordPress creates this automatically)
```sql
id | date | question | answer | category | created_at
1  | 2025-01-15 | What does API stand for? | Application Programming Interface | Basics | 2025-01-15 02:00:00
2  | 2025-01-16 | Which company created React? | Meta | Frameworks | 2025-01-16 02:00:00
```

### Plugin Settings (WordPress Admin)
- OpenAI API Key (encrypted storage)
- Daily generation time (default: 2 AM)
- Enable/disable automatic generation
- Manual generation button (backup)

---

## Implementation Details

### 1. Daily AI Generation
```php
// WordPress cron job (runs automatically)
function generate_daily_trivia() {
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    
    // Check if already exists
    if (trivia_exists($tomorrow)) {
        return; // Skip if already generated
    }
    
    // Call OpenAI
    $trivia = call_openai_for_trivia();
    
    // Save to WordPress database
    save_trivia_to_db($tomorrow, $trivia);
}
```

### 2. OpenAI Integration
```php
function call_openai_for_trivia() {
    $prompt = "Generate tech trivia: question and answer for software engineers...";
    
    $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
        'headers' => ['Authorization' => 'Bearer ' . get_option('trivia_openai_key')],
        'body' => json_encode(['messages' => [['role' => 'user', 'content' => $prompt]]])
    ]);
    
    return parse_openai_response($response);
}
```

### 3. Display Widget
```php
// Shortcode: [tech_trivia]
function display_tech_trivia() {
    $today_trivia = get_todays_trivia();
    
    if (!$today_trivia) {
        return "No trivia available today. Check back tomorrow!";
    }
    
    return render_trivia_widget($today_trivia);
}
```

---

## User Interface (Simple)

### Frontend Display
```html
<div class="tech-trivia-widget">
    <h3>🧠 Daily Tech Trivia</h3>
    
    <div class="question">
        <p><strong>Question:</strong> What does API stand for?</p>
    </div>
    
    <div class="answer-section">
        <input type="text" placeholder="Your answer..." id="user-answer">
        <button onclick="checkAnswer()">Submit</button>
    </div>
    
    <div class="result" id="result-area">
        <!-- Shows "Correct!" or "Try again" after submit -->
    </div>
    
    <div class="meta">
        <small>Category: Programming Basics | Come back tomorrow for a new question!</small>
    </div>
</div>
```

### Admin Interface (WordPress Backend)
```
Settings → Tech Trivia
┌─────────────────────────────────┐
│ OpenAI API Key: [input field]  │
│ Generation Time: [2 AM] ▼      │
│ Auto Generate: ☑ Enabled       │
│                                 │
│ [Save Settings]                 │
│ [Generate Today's Trivia Now]   │
│                                 │
│ Last Generated: Jan 15, 2025    │
│ Questions in Database: 47       │
└─────────────────────────────────┘
```

---

## Installation Process

### For Developer
1. **Create plugin file** with all functionality
2. **Test on staging site**
3. **Provide .zip file to you**

### For You
1. **Upload plugin** via WordPress admin
2. **Activate plugin**
3. **Go to Settings → Tech Trivia**
4. **Add OpenAI API key**
5. **Click "Generate Today's Trivia Now"** (test)
6. **Add shortcode** `[tech_trivia]` to any page
7. **Done!**

---

## Error Handling

### If AI Fails
- Shows yesterday's question with note
- Admin gets email notification
- Manual generation button available
- Retries automatically next day

### If No Internet
- Shows cached question from database
- Graceful fallback message
- Continues working when connection restored

---

## Features Included

### User Features
- Daily tech trivia question
- Answer input and validation
- Success/failure feedback
- Category display
- Mobile-friendly design

### Admin Features
- View all generated questions
- Manual question generation
- Settings management
- Basic statistics (questions generated, etc.)

### Automatic Features
- Daily content generation
- Database cleanup (keeps 90 days)
- Cron job scheduling
- Error logging

---

## What You Don't Need

- ❌ External databases
- ❌ Third-party services
- ❌ Google Sheets setup
- ❌ Additional monthly fees (except OpenAI)
- ❌ Complex configuration
- ❌ Database management knowledge

---

## Budget & Timeline

### Development Cost
- **Simple Plugin**: $2,000 - $3,500
- **Testing & Refinement**: $500 - $1,000
- **Total**: $2,500 - $4,500

### Monthly Costs
- **OpenAI API**: $20 - $50
- **Everything else**: $0

### Timeline
- **Week 1**: Core plugin development
- **Week 2**: Testing and refinement
- **Week 3**: Documentation and delivery

---

## Future Enhancements (Optional)

### Easy Additions Later
- Multiple difficulty levels
- User scoring system
- Weekly/monthly themes
- Social sharing buttons
- Admin dashboard with analytics

### Medium Additions
- Multiple choice questions
- Hint system
- User accounts
- Leaderboards

All additions can be made without changing the core system.

---

## Success Metrics

### What to Track
- Daily question generation success rate
- User engagement (answers submitted)
- Page views on trivia page
- API costs vs usage

### WordPress Built-in Analytics
- Page views via WordPress stats
- User interaction via admin dashboard
- Error logs via WordPress debug

This approach is the absolute simplest while meeting all your requirements: stays on your website, minimal external dependencies, easy to manage, and professional quality.