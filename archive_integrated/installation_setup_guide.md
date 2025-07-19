# Daily Tech Trivia - Installation & Setup Guide

## Pre-Installation Checklist

### Requirements
- [ ] WordPress 5.8 or higher
- [ ] PHP 7.4 or higher
- [ ] OpenAI API account and key
- [ ] WordPress admin access
- [ ] FTP/file manager access (if needed)

### Get OpenAI API Key
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account or log in
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key (starts with `sk-...`)
6. **Save this key securely** - you'll need it for setup

---

## Installation Process

### Step 1: Upload Plugin
**Option A: WordPress Admin (Recommended)**
1. Log into WordPress admin
2. Go to **Plugins → Add New**
3. Click **"Upload Plugin"**
4. Choose the `daily-tech-trivia.zip` file
5. Click **"Install Now"**
6. Click **"Activate Plugin"**

**Option B: FTP Upload**
1. Extract the plugin zip file
2. Upload `daily-tech-trivia` folder to `/wp-content/plugins/`
3. Go to WordPress admin → Plugins
4. Find "Daily Tech Trivia" and click **"Activate"**

### Step 2: Configure Settings
1. In WordPress admin, go to **Settings → Tech Trivia**
2. **Gemini API Key**: Paste your Google Gemini API key.
3. **Google Service Account JSON**: Upload the JSON file you downloaded from the Google Cloud Console.
4. **Google Sheet ID**: Enter the ID of your Google Sheet (from the URL).
5. **Google Sheet Name**: Enter the name of the sheet (e.g., "Sheet1").
6. **Generation Time**: Leave as "02:00" (2 AM) or change if preferred
7. **Auto Generate**: Check "Enabled"
8. Click **"Save Settings"**

### Step 3: Test Setup
1. Click **"Generate Today's Trivia Now"** button
2. Should see success message: "Trivia generated successfully!"
3. If error appears, check API key and try again

### Step 4: Add to Website
1. Edit any page or post where you want trivia
2. Add the shortcode: `[tech_trivia]`
3. **Save/Update** the page
4. **View page** to see trivia widget

---

## Verification & Testing

### Confirm Plugin Working
1. **Check Database**: Settings → Tech Trivia should show "Questions in Database: 1+"
2. **View Frontend**: Visit page with shortcode, should see today's question
3. **Test Answer**: Submit correct answer, should see "Correct!" message
4. **Check Cron**: Next generation should be scheduled (visible in settings)

### Troubleshooting Common Issues

#### "API Error" Messages
**Cause**: Invalid OpenAI API key or network issue
**Solution**: 
- Double-check API key in settings
- Ensure no extra spaces in key
- Try manual generation again
- Check OpenAI account has credits

#### "No Trivia Available" Message
**Cause**: No trivia generated yet or database issue
**Solution**:
- Click "Generate Today's Trivia Now" in settings
- Check WordPress error logs
- Verify database table created (ask developer)

#### Shortcode Shows Raw Text
**Cause**: Plugin not activated or shortcode typo
**Solution**:
- Verify plugin is activated
- Check shortcode spelling: `[tech_trivia]` (no spaces)
- Try adding to different page

#### Cron Not Running
**Cause**: WordPress cron issues (common)
**Solution**:
- Use manual generation for now
- Ask hosting provider about cron jobs
- Consider upgrading to real cron job

---

## Daily Usage

### What Happens Automatically
- **2 AM Daily**: New trivia question generated
- **Website Updates**: Shows new question automatically
- **User Experience**: Fresh content every day

### What You Can Do
- **Monitor**: Check Settings page for generation status
- **Manual Generate**: Click button if automatic fails
- **View Questions**: See recent trivia in admin
- **Edit Pages**: Move shortcode to different pages anytime

### Content Management
- **View All Questions**: Settings → Tech Trivia → "View Recent Questions"
- **Categories**: Automatically varied by AI (Programming, Cloud, Security, etc.)
- **Difficulty**: Automatically scaled throughout month
- **Quality**: AI generates professional-level tech trivia

---

## Customization Options

### Styling the Widget
**Basic Customization** (WordPress Customizer):
1. Go to **Appearance → Customize**
2. **Additional CSS** section
3. Add custom styles:

```css
/* Customize trivia widget appearance */
.tech-trivia-widget {
    background: #your-brand-color;
    border-radius: 10px;
    padding: 20px;
}

.tech-trivia-widget h3 {
    color: #your-text-color;
}
```

### Placement Options
- **Pages**: Add `[tech_trivia]` to any page
- **Posts**: Include in blog posts
- **Widgets**: Use in sidebar (if theme supports shortcodes in widgets)
- **Footer**: Add to footer area
- **Multiple Places**: Use shortcode multiple times

---

## Monitoring & Maintenance

### Weekly Checks
- [ ] Visit trivia page to confirm new questions appearing
- [ ] Check Settings page for any error messages
- [ ] Monitor OpenAI API usage/costs

### Monthly Reviews
- [ ] Review question quality in admin
- [ ] Check API costs vs budget
- [ ] Consider user feedback and engagement

### Backup Considerations
- **Plugin Settings**: API key is stored in WordPress database
- **Trivia Questions**: Stored in WordPress database (included in normal backups)
- **No External Data**: Everything backed up with regular WordPress backup

---

## Support & Troubleshooting

### Log Files
**WordPress Debug Logs**: Look for "Daily Tech Trivia" entries
- Location: `/wp-content/debug.log`
- Enable: Add to `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

### Common Error Messages

**"OpenAI API Error: 401"**
- Invalid API key
- Check key in settings, ensure no extra characters

**"OpenAI API Error: 429"**
- Rate limit exceeded
- Wait and try again, or upgrade OpenAI plan

**"Database Error"**
- Table creation failed
- Contact developer or hosting support

**"Cron Not Scheduled"**
- WordPress cron issues
- Use manual generation as backup

### Getting Help
1. **Check error logs** first
2. **Try manual generation** to isolate issues
3. **Document exact error messages**
4. **Contact developer** with specific details

---

## Success Metrics

### Track These Analytics
- **Page views** on trivia page
- **User engagement** (answers submitted)
- **API costs** vs budget
- **Question generation** success rate

### WordPress Analytics
- Use Google Analytics on trivia page
- Monitor WordPress admin for generation status
- Track user comments/feedback

This setup should give you a fully automated, professional tech trivia system that runs itself while staying entirely on your website!