# AI Prompt for Daily Tech Trivia Generation (Simplified)

## Master Prompt Template

```
You are generating daily tech trivia for a WordPress plugin that uses the Google Gemini API.

Create ONE trivia question with a clear, factual answer. Make it challenging but fair for tech professionals.

**OUTPUT FORMAT (JSON):**
```json
{
  "question": "What does API stand for?",
  "answer": "Application Programming Interface",
  "category": "Programming Basics",
  "difficulty": 2,
  "fun_fact": "APIs were first used in the 1960s for operating systems"
}
```

**QUESTION CRITERIA:**
- Clear, unambiguous question
- Single correct answer (not subjective)
- Relevant to tech professionals
- Can be answered in 1-5 words typically
- Not too obscure or too obvious

**CATEGORIES TO ROTATE:**
- Programming Languages (Python, JavaScript, etc.)
- Cloud Computing (AWS, Azure, Docker, etc.) 
- Companies & Startups (Google, Meta, Stripe, etc.)
- Hardware & Systems (CPU, RAM, GPU, etc.)
- Security & Protocols (HTTPS, OAuth, etc.)
- AI & Machine Learning (Neural Networks, etc.)
- Web Development (React, HTML, CSS, etc.)

**DIFFICULTY LEVELS:**
- Level 1: Basic terms most developers know
- Level 2: Common professional knowledge  
- Level 3: Intermediate specialist knowledge
- Level 4: Advanced or detailed knowledge
- Level 5: Expert or very specific knowledge

**SAMPLE GOOD QUESTIONS:**

**Easy (Level 1-2):**
- "What does HTML stand for?"
- "Which company created React?"
- "What year was Python first released?"

**Medium (Level 3):**
- "What does the 'S' in HTTPS stand for?"
- "Which AWS service is used for serverless computing?"
- "What programming language was originally called Oak?"

**Hard (Level 4-5):**
- "What does CORS stand for in web development?"
- "Which company originally developed Kubernetes?"
- "What year did Git version control first release?"

**QUESTION STYLE GUIDELINES:**
- Use "What", "Which", "Who", "When" questions
- Avoid yes/no questions
- Make questions specific and factual
- Include context when helpful ("In programming...", "AWS service for...")
- Keep questions under 100 characters when possible

**ANSWER GUIDELINES:**
- Provide the most common/accepted answer
- Keep answers concise (1-10 words typically)
- For acronyms, give the full form
- For years, just provide the year number
- For companies, use current/most known name

Generate one trivia question following this format exactly. Make it appropriate for competitive, knowledgeable tech professionals.
```

## Usage for Google Sheets Integration

### Daily API Call Structure
```javascript
// Simplified generation for Google Sheets
async function generateDailyTrivia(date) {
    const prompt = `${masterPrompt}
    
    Today is ${date.toDateString()}. 
    Generate a difficulty level ${Math.ceil((date.getDate() % 5) + 1)} question.
    Focus on practical knowledge that tech professionals use.
    `;
    
    const response = await callOpenAI(prompt);
    const trivia = JSON.parse(response);
    
    // Add to Google Sheets row
    return [
        date.toISOString().split('T')[0], // Date column
        trivia.question,                  // Question column  
        trivia.answer,                    // Answer column
        trivia.category,                  // Category column
        'AI Generated'                    // Source column
    ];
}
```

### Google Sheets Format
The AI output gets converted to a simple row:

| Date | Question | Answer | Category | Source |
|------|----------|--------|----------|--------|
| 2025-01-15 | What does API stand for? | Application Programming Interface | Programming Basics | AI Generated |

### Content Validation (Simple)
```javascript
function validateTrivia(trivia) {
    return (
        trivia.question && trivia.question.length > 10 &&
        trivia.answer && trivia.answer.length > 1 &&
        trivia.category && 
        trivia.difficulty >= 1 && trivia.difficulty <= 5
    );
}
```

## Backup Prompt (Emergency)
```
If main prompt fails, use this simple backup:

Create a tech trivia question and answer. Format as JSON:

{
  "question": "Your question here?",
  "answer": "Simple answer",
  "category": "Tech category"
}

Examples:
- Question: "What does CSS stand for?" Answer: "Cascading Style Sheets"
- Question: "Which company created iPhone?" Answer: "Apple"  
- Question: "What year was JavaScript created?" Answer: "1995"

Pick something tech professionals would know but might need to think about.
```

## Manual Content Examples (For Google Sheets)

### Easy Questions (Level 1-2)
```csv
Date,Question,Answer,Category,Source
2025-01-15,What does CPU stand for?,Central Processing Unit,Hardware,Manual
2025-01-16,Which company created WordPress?,Automattic,Companies,Manual
2025-01-17,What does HTTP stand for?,HyperText Transfer Protocol,Protocols,Manual
```

### Medium Questions (Level 3)
```csv
Date,Question,Answer,Category,Source
2025-01-18,What port does HTTPS typically use?,443,Security,Manual
2025-01-19,Which database is known as NoSQL?,MongoDB,Databases,Manual
2025-01-20,What does CDN stand for?,Content Delivery Network,Web,Manual
```

### Hard Questions (Level 4-5)
```csv
Date,Question,Answer,Category,Source
2025-01-21,What year was Docker first released?,2013,DevOps,Manual
2025-01-22,Which company originally created Kubernetes?,Google,Cloud,Manual
2025-01-23,What does CORS stand for?,Cross-Origin Resource Sharing,Security,Manual
```

## Quality Guidelines for Manual Editing

### Good Questions Have:
- ✅ One clear correct answer
- ✅ Relevant to tech work
- ✅ Factual and verifiable
- ✅ Appropriate difficulty for audience

### Avoid Questions That:
- ❌ Have multiple possible answers
- ❌ Are too opinion-based
- ❌ Require very specialized knowledge
- ❌ Are outdated or no longer relevant

### Category Guidelines
- **Programming**: Languages, syntax, concepts
- **Cloud**: AWS, Azure, GCP services and concepts  
- **Companies**: Tech company facts, history, products
- **Hardware**: Computer components, specifications
- **Security**: Protocols, methods, best practices
- **Web**: Frontend, backend, frameworks
- **AI/ML**: Machine learning terms and concepts

This simplified approach makes it super easy to manage content in a Google Sheet while still providing engaging trivia for your tech audience!