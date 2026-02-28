---
name: Keynote Creator
description: Guide for creating and editing Keynote presentations using AppleScript via bash
---

# Keynote Creator Skill

This skill guides you on how to create and manipulate Keynote presentations on macOS using AppleScript.

## When to Use

Create a Keynote presentation when the user asks to:
- Create a presentation/slideshow/PPT
- Generate slides from documents, reports, or data
- Make a pitch deck, proposal, or summary presentation
- Convert content into visual presentation format

## Workflow

1. **Open Keynote** (for visual demo): Use `macos_show(app: "keynote")` if visual mode is enabled
2. **Create presentation**: Use bash with AppleScript
3. **Add slides**: Use AppleScript to add and configure slides
4. **Set content**: Add titles, body text, and images
5. **Export**: Save as .key or export to PDF

## CRITICAL: Stability Best Practices

**ALWAYS use a SINGLE AppleScript to create the entire presentation.** Do NOT run multiple separate scripts.

Why this matters:
- Each `osascript` invocation may restart Keynote's scripting bridge
- Multiple rapid scripts cause Keynote to crash or become unresponsive
- A single comprehensive script is much more stable

**Bad approach** (causes crashes):
```bash
# Script 1: Create document
osascript -e 'tell application "Keynote" to make new document'
# Script 2: Add slide 1
osascript -e 'tell application "Keynote" to tell front document to make new slide'
# Script 3: Set title
osascript -e 'tell application "Keynote" to tell front document to ...'
# This will likely crash!
```

**Good approach** (stable):
```bash
osascript << 'EOF'
tell application "Keynote"
    activate
    delay 1  -- Wait for Keynote to fully launch
    
    -- Do ALL operations in ONE script
    set newDoc to make new document with properties {document theme:theme "White"}
    delay 0.5  -- Brief pause after creating document
    
    tell newDoc
        -- All slides and content in one block
        ...
    end tell
end tell
EOF
```

**Required delays:**
- After `activate`: `delay 1` (let app fully launch)
- After `make new document`: `delay 0.5`
- After adding each slide: `delay 0.3` (optional but recommended for many slides)

## AppleScript Patterns

### Create New Presentation

```bash
osascript << 'EOF'
tell application "Keynote"
    activate
    set newDoc to make new document with properties {document theme:theme "White"}
    return name of newDoc
end tell
EOF
```

**Available themes**: "White", "Black", "Gradient", "Classic", "Modern Type", "Showcase", "Photo Essay", "Bold", "Industrial", "Blueprint"

### Add a Slide

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        -- Add slide with specific layout
        set newSlide to make new slide with properties {base slide:master slide "Title - Center"}
    end tell
end tell
EOF
```

**Common master slides (layouts)**:
- `"Title - Center"` - Title and subtitle centered
- `"Title - Top"` - Title at top with content area
- `"Title & Subtitle"` - Classic title slide
- `"Title & Bullets"` - Title with bullet points
- `"Title, Bullets & Photo"` - Title, bullets, and image
- `"Bullets"` - Full slide bullet points
- `"Photo"` - Full slide image
- `"Photo - Horizontal"` - Landscape photo layout
- `"Quote"` - Quote layout
- `"Blank"` - Empty slide

### Set Slide Title and Body

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        tell current slide
            -- Set title
            set object text of default title item to "Your Title Here"
            
            -- Set body text (for slides with body placeholder)
            set object text of default body item to "• Point 1
• Point 2
• Point 3"
        end tell
    end tell
end tell
EOF
```

### Add Text Box with Custom Position

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        tell current slide
            set newText to make new text item with properties {object text:"Custom text here"}
            set position of newText to {100, 200}
            set width of newText to 400
            set height of newText to 100
        end tell
    end tell
end tell
EOF
```

### Add Image to Slide

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        tell current slide
            set imgFile to POSIX file "/path/to/image.jpg"
            set newImage to make new image with properties {file:imgFile}
            set position of newImage to {300, 200}
            set width of newImage to 400
        end tell
    end tell
end tell
EOF
```

### Navigate to Specific Slide

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        set current slide to slide 3
    end tell
end tell
EOF
```

### Get Slide Count

```bash
osascript -e 'tell application "Keynote" to count slides of front document'
```

### Export to PDF

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        set exportPath to POSIX file "/Users/username/Desktop/presentation.pdf"
        export to exportPath as PDF
    end tell
end tell
EOF
```

### Save Presentation

```bash
osascript << 'EOF'
tell application "Keynote"
    tell front document
        set savePath to POSIX file "/Users/username/Desktop/my_presentation.key"
        save in savePath
    end tell
end tell
EOF
```

## Complete Example: Multi-Slide Presentation

**This is the recommended pattern - ALL operations in ONE script with proper delays:**

```bash
osascript << 'EOF'
tell application "Keynote"
    activate
    delay 1  -- IMPORTANT: Wait for Keynote to fully launch
    
    -- Create new document
    set newDoc to make new document with properties {document theme:theme "White"}
    delay 0.5  -- Wait for document to initialize
    
    tell newDoc
        -- First slide is created automatically, set it as title slide
        tell slide 1
            set base slide to master slide "Title - Center"
            set object text of default title item to "Q1 2026 Business Review"
            set object text of default body item to "Financial Services Division"
        end tell
        delay 0.3
        
        -- Add Overview slide
        set slide2 to make new slide with properties {base slide:master slide "Title & Bullets"}
        delay 0.3
        tell slide2
            set object text of default title item to "Executive Summary"
            set object text of default body item to "• Revenue increased 15% YoY
• New client acquisition: $15M AUM
• Client satisfaction: 4.8/5.0
• All portfolios outperforming benchmarks"
        end tell
        
        -- Add Performance slide
        set slide3 to make new slide with properties {base slide:master slide "Title & Bullets"}
        delay 0.3
        tell slide3
            set object text of default title item to "Investment Performance"
            set object text of default body item to "• Growth Portfolio: +3.2% (Benchmark +2.8%)
• Balanced Portfolio: +2.1% (Benchmark +1.9%)
• Income Portfolio: +0.9% (Benchmark +0.7%)
• Average Alpha: +0.3%"
        end tell
        
        -- Add Next Steps slide
        set slide4 to make new slide with properties {base slide:master slide "Title & Bullets"}
        delay 0.3
        tell slide4
            set object text of default title item to "Q2 Priorities"
            set object text of default body item to "• Complete endowment fund implementation
• Expand alternative investment offerings
• Launch client education seminar series
• Target: $25M total new AUM"
        end tell
        
        delay 0.5  -- Wait before saving
        -- Save the presentation
        set savePath to POSIX file "~/Desktop/Q1_Review.key"
        save in savePath
    end tell
    
    return "Presentation created with 4 slides"
end tell
EOF
```

**Key points about this example:**
1. Single `osascript` command containing everything
2. `delay 1` after activate to let Keynote fully launch
3. `delay 0.5` after creating document
4. `delay 0.3` after each `make new slide`
5. `delay 0.5` before save operation

## Tips for Better Presentations

1. **Structure**: Always start with a title slide, then overview, details, and conclusion
2. **Bullet Points**: Keep to 4-6 points per slide for readability
3. **Titles**: Use clear, action-oriented titles
4. **Consistency**: Use the same master slide for similar content types
5. **Images**: Position images consistently across slides

## Error Handling

When Keynote operations fail, common issues are:
- **Crashes/Freezes**: Almost always caused by running multiple separate scripts. Solution: Combine into ONE script.
- **App not running**: Use `macos_show(app: "keynote")` first, then wait 1-2 seconds before running the creation script.
- **Invalid master slide name**: Check available layouts with document's master slides
- **File path issues**: Always use POSIX file syntax and expand ~ to full path (e.g., `/Users/username/Desktop/`)
- **"Keynote got an error"**: Add more `delay` statements, especially after `make new slide`

**If the script times out or crashes:**
1. First, check if Keynote is still open - it may have created partial content
2. Try adding longer delays (e.g., `delay 1` instead of `delay 0.3`)
3. For very long presentations (10+ slides), consider splitting into two separate runs

## Recommended Workflow for Generating from Reports

1. **Read the source** (reports, documents)
2. **Plan slide structure** (identify key sections)
3. **Create presentation** with appropriate theme
4. **Add slides iteratively** - one at a time with content
5. **Save and Export** - save as .key AND export to PDF
6. **Close Keynote** - always close the app after finishing (see below)
7. **Send BOTH files** to user via messaging platform (.key for editing, PDF for viewing)

## Closing Keynote After Creation

**IMPORTANT**: Always close Keynote after you finish creating and saving the presentation.

If you have `macos_close` tool available (Visual Demo Mode), use:
```
macos_close(target: "keynote", delay_ms: 500)
```

Alternatively, use AppleScript:
```bash
osascript -e 'tell application "Keynote" to quit'
```

This keeps the user's desktop clean and shows a complete workflow.

## File Handling

- Save .key files to `~/Desktop/` or user's preferred location
- Export PDF to the same location with same base name
- Use descriptive filenames with dates (e.g., `Q1_2026_Review.key` and `Q1_2026_Review.pdf`)
- **IMPORTANT**: Always send both .key and .pdf files to the user
