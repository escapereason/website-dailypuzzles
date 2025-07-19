# Daily Tech Trivia - Technical Specification Document

## Project Architecture Overview

### System Components
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WordPress     │    │    OpenAI       │    │   Frontend      │
│   Database      │◄───┤     API         │◄───┤    Widget       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │   WordPress       │
                        │   Cron System     │
                        └───────────────────┘
```

### Data Flow
1. **Daily Trigger**: WordPress cron executes at scheduled time
2. **AI Generation**: OpenAI API called with tech trivia prompt
3. **Data Storage**: Generated trivia saved to WordPress database
4. **Frontend Display**: Shortcode retrieves and displays current trivia
5. **User Interaction**: AJAX handles answer submission and validation

---

## Database Design

### Table Schema: `wp_daily_trivia`
```sql
CREATE TABLE IF NOT EXISTS {$wpdb->prefix}daily_trivia (
    id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
    trivia_date date NOT NULL,
    question text NOT NULL,
    answer varchar(255) NOT NULL,
    category varchar(100) DEFAULT 'General',
    difficulty tinyint(4) DEFAULT 3,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY unique_date (trivia_date),
    KEY idx_date (trivia_date),
    KEY idx_category (category)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Data Validation Rules
- `trivia_date`: Must be unique, format YYYY-MM-DD
- `question`: Required, min 10 characters, max 1000 characters
- `answer`: Required, min 1 character, max 255 characters
- `category`: Enum-like validation for predefined categories
- `difficulty`: Integer 1-5 only

### Database Operations
```php
class TriviaDatabase {
    public function create_table() { /* Table creation logic */ }
    public function insert_trivia($date, $question, $answer, $category, $difficulty) { /* Insert with validation */ }
    public function get_trivia_by_date($date) { /* Retrieve specific date */ }
    public function trivia_exists($date) { /* Check existence */ }
    public function cleanup_old_trivia($days = 90) { /* Remove old entries */ }
}
```

---

## OpenAI API Integration

### API Configuration
```php
class OpenAIIntegration {
    private $api_key;
    private $api_url = 'https://api.openai.com/v1/chat/completions';
    private $model = 'gpt-3.5-turbo';
    private $max_tokens = 300;
    private $temperature = 0.7;
}
```

### Request Structure
```php
$request_data = [
    'model' => 'gpt-3.5-turbo',
    'messages' => [
        [
            'role' => 'system',
            'content' => 'You are an expert tech trivia generator...'
        ],
        [
            'role' => 'user', 
            'content' => $this->generate_prompt()
        ]
    ],
    'max_tokens' => 300,
    'temperature' => 0.7
];
```

### Prompt Engineering
```php
private function generate_prompt() {
    $categories = ['Programming', 'Cloud Computing', 'Security', 'Hardware', 'AI/ML'];
    $today_category = $categories[date('N') % count($categories)];
    $difficulty = min(5, max(1, (date('j') % 5) + 1));
    
    return "Generate tech trivia for {$today_category} category, difficulty {$difficulty}. 
            Return JSON: {'question': 'clear question?', 'answer': 'concise answer', 
            'category': '{$today_category}', 'difficulty': {$difficulty}}";
}
```

### Error Handling
```php
private function handle_api_error($response) {
    if (wp_remote_retrieve_response_code($response) !== 200) {
        $error_data = json_decode(wp_remote_retrieve_body($response), true);
        $error_message = $error_data['error']['message'] ?? 'Unknown Gemini API error';
        return new WP_Error('gemini_api_error', 'Google Gemini API Error: ' . $error_message);
    }
}
```

---

## Google Sheets API Integration

### API Configuration
```php
class GoogleSheetsIntegration {
    private $credentials_path;
    private $spreadsheet_id;
    private $sheet_name;

    public function __construct() {
        // Load credentials from admin settings
    }

    public function add_row($data) {
        // Logic to authenticate with Google and add a row
    }
}
```

### Data Flow to Google Sheets
```php
// In generate_trivia_callback() after successful DB insertion
$this->google_sheets->add_row([
    $tomorrow,
    $trivia_data['question'],
    $trivia_data['answer'],
    $trivia_data['category'],
    $trivia_data['difficulty']
]);
```

### Admin Settings
- Google Sheets Spreadsheet ID
- Google Sheets Sheet Name
- Google Service Account JSON credentials upload

---

## WordPress Cron Implementation

### Cron Registration
```php
class CronManager {
    public function __construct() {
        register_activation_hook(__FILE__, [$this, 'schedule_cron']);
        register_deactivation_hook(__FILE__, [$this, 'unschedule_cron']);
        add_action('generate_daily_tech_trivia', [$this, 'generate_trivia_callback']);
    }
    
    public function schedule_cron() {
        if (!wp_next_scheduled('generate_daily_tech_trivia')) {
            $time = strtotime('tomorrow 2:00 AM');
            wp_schedule_event($time, 'daily', 'generate_daily_tech_trivia');
        }
    }
}
```

### Generation Logic
```php
public function generate_trivia_callback() {
    $tomorrow = date('Y-m-d', strtotime('+1 day'));
    
    // Prevent duplicate generation
    if ($this->database->trivia_exists($tomorrow)) {
        error_log("Daily Tech Trivia: Trivia already exists for {$tomorrow}");
        return;
    }
    
    // Generate new trivia
    $trivia_data = $this->openai->generate_trivia();
    
    if (is_wp_error($trivia_data)) {
        error_log("Daily Tech Trivia: Generation failed - " . $trivia_data->get_error_message());
        return;
    }
    
    // Save to database
    $result = $this->database->insert_trivia(
        $tomorrow,
        $trivia_data['question'],
        $trivia_data['answer'],
        $trivia_data['category'],
        $trivia_data['difficulty']
    );
    
    if ($result) {
        error_log("Daily Tech Trivia: Successfully generated for {$tomorrow}");
    }
}
```

---

## Frontend Implementation

### Shortcode Registration
```php
class FrontendDisplay {
    public function __construct() {
        add_shortcode('tech_trivia', [$this, 'display_trivia_widget']);
        add_action('wp_enqueue_scripts', [$this, 'enqueue_scripts']);
        add_action('wp_ajax_check_trivia_answer', [$this, 'ajax_check_answer']);
        add_action('wp_ajax_nopriv_check_trivia_answer', [$this, 'ajax_check_answer']);
    }
}
```

### Widget HTML Structure
```php
private function render_widget($trivia) {
    $nonce = wp_create_nonce('trivia_answer_nonce');
    
    return "
    <div class='tech-trivia-widget' data-trivia-id='{$trivia->id}'>
        <div class='trivia-header'>
            <h3>🧠 Daily Tech Trivia</h3>
            <span class='trivia-category'>{$trivia->category}</span>
        </div>
        
        <div class='trivia-question'>
            <p><strong>Question:</strong> {$trivia->question}</p>
        </div>
        
        <div class='trivia-answer-section'>
            <input type='text' id='trivia-answer' placeholder='Your answer...' maxlength='255'>
            <button id='submit-answer' data-nonce='{$nonce}'>Submit</button>
        </div>
        
        <div class='trivia-result' id='trivia-result'></div>
        
        <div class='trivia-meta'>
            <small>Difficulty: " . str_repeat('⭐', $trivia->difficulty) . " | Come back tomorrow!</small>
        </div>
    </div>";
}
```

### AJAX Answer Validation
```php
public function ajax_check_answer() {
    // Security checks
    if (!wp_verify_nonce($_POST['nonce'], 'trivia_answer_nonce')) {
        wp_die('Security check failed');
    }
    
    $user_answer = sanitize_text_field($_POST['answer']);
    $trivia_id = intval($_POST['trivia_id']);
    $guess_count = intval($_POST['guesses']);
    
    // Get correct answer
    $trivia = $this->database->get_trivia_by_id($trivia_id);
    
    // Check answer
    $is_correct = $this->validate_answer($user_answer, $trivia->answer);
    
    $message = $is_correct ? 'Correct! 🎉' : 'Not quite right. Try again!';
    
    wp_send_json([
        'success' => true,
        'correct' => $is_correct,
        'message' => $message
    ]);
}
```

### Answer Matching Algorithm
```php
private function validate_answer($user_answer, $correct_answer) {
    // Normalize both answers
    $user_normalized = $this->normalize_answer($user_answer);
    $correct_normalized = $this->normalize_answer($correct_answer);
    
    // Exact match
    if ($user_normalized === $correct_normalized) {
        return true;
    }
    
    // Check for common abbreviations
    $abbreviations = [
        'application programming interface' => 'api',
        'hypertext markup language' => 'html',
        'cascading style sheets' => 'css',
        // Add more as needed
    ];
    
    foreach ($abbreviations as $full => $abbrev) {
        if (($user_normalized === $full && $correct_normalized === $abbrev) ||
            ($user_normalized === $abbrev && $correct_normalized === $full)) {
            return true;
        }
    }
    
    // Fuzzy matching for typos (optional)
    return $this->fuzzy_match($user_normalized, $correct_normalized);
}

private function normalize_answer($answer) {
    return trim(strtolower(preg_replace('/[^a-z0-9\s]/', '', $answer)));
}
```

---

## Admin Interface

### Settings Page Structure
```php
class AdminInterface {
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'init_settings']);
        add_action('wp_ajax_manual_generate_trivia', [$this, 'manual_generate']);
    }
    
    public function add_admin_menu() {
        add_options_page(
            'Tech Trivia Settings',
            'Tech Trivia', 
            'manage_options',
            'tech-trivia-settings',
            [$this, 'settings_page']
        );
    }
}
```

### Settings Registration
```php
public function init_settings() {
    register_setting('tech_trivia_settings', 'tech_trivia_openai_key', [
        'sanitize_callback' => [$this, 'encrypt_api_key']
    ]);
    
    register_setting('tech_trivia_settings', 'tech_trivia_generation_time', [
        'sanitize_callback' => 'sanitize_text_field',
        'default' => '02:00'
    ]);
    
    register_setting('tech_trivia_settings', 'tech_trivia_auto_generate', [
        'sanitize_callback' => 'rest_sanitize_boolean',
        'default' => true
    ]);
}
```

---

## Security Implementation

### Data Sanitization
```php
private function sanitize_trivia_data($data) {
    return [
        'question' => wp_kses_post($data['question']),
        'answer' => sanitize_text_field($data['answer']),
        'category' => sanitize_text_field($data['category']),
        'difficulty' => max(1, min(5, intval($data['difficulty'])))
    ];
}
```

### API Key Encryption
```php
private function encrypt_api_key($key) {
    if (empty($key)) return '';
    
    // Use WordPress salts for encryption
    $salt = wp_salt('secure_auth');
    return base64_encode(openssl_encrypt($key, 'AES-256-CBC', $salt, 0, substr($salt, 0, 16)));
}

private function decrypt_api_key($encrypted_key) {
    if (empty($encrypted_key)) return '';
    
    $salt = wp_salt('secure_auth');
    return openssl_decrypt(base64_decode($encrypted_key), 'AES-256-CBC', $salt, 0, substr($salt, 0, 16));
}
```

### CSRF Protection
```php
private function verify_admin_request() {
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }
    
    if (!wp_verify_nonce($_POST['_wpnonce'], 'tech_trivia_admin')) {
        wp_die('Security check failed');
    }
}
```

---

## Performance Optimization

### Caching Strategy
```php
private function get_todays_trivia() {
    $cache_key = 'tech_trivia_' . date('Y-m-d');
    $trivia = wp_cache_get($cache_key);
    
    if (false === $trivia) {
        $trivia = $this->database->get_trivia_by_date(date('Y-m-d'));
        wp_cache_set($cache_key, $trivia, '', HOUR_IN_SECONDS);
    }
    
    return $trivia;
}
```

### Database Optimization
```php
// Index for frequent queries
private function optimize_database() {
    global $wpdb;
    $table = $wpdb->prefix . 'daily_trivia';
    
    $wpdb->query("CREATE INDEX IF NOT EXISTS idx_date ON {$table} (trivia_date)");
    $wpdb->query("CREATE INDEX IF NOT EXISTS idx_category ON {$table} (category)");
}
```

---

## Error Handling & Logging

### Comprehensive Error Logging
```php
private function log_error($message, $context = []) {
    $log_entry = [
        'timestamp' => current_time('mysql'),
        'message' => $message,
        'context' => $context,
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? ''
    ];
    
    error_log('Daily Tech Trivia: ' . json_encode($log_entry));
}
```

### Graceful Degradation
```php
private function get_fallback_trivia() {
    return [
        'question' => 'What does CSS stand for?',
        'answer' => 'Cascading Style Sheets',
        'category' => 'Web Development',
        'difficulty' => 2
    ];
}
```

This technical specification provides developers with all the details needed to build a robust, secure, and performant daily tech trivia system.