# Bagrut Practice

An interactive web app for practicing Israeli Bagrut foreign-language exams, deployed as GitHub Pages.

## What it does

- Loads all exam JSON files from the `exams/` folder automatically (via the GitHub Contents API — no manifest needed)
- Shows an exam picker when multiple exams are available; skips straight to the exam when there's only one
- Presents all four section types with appropriate interactive UI:
  - **Reading comprehension** — free-text textarea, submit reveals model answer + self-grade buttons
  - **Verb conjugation** — inline fill-in-the-blank with instant green/red feedback as you type
  - **Vocabulary cloze** — clickable word-bank chips + numbered blanks, instant feedback on placement
  - **Question formulation** — write a question for a given answer, submit reveals model question + self-grade
- Tracks a live score (out of 100) in the header; auto-graded for verb/cloze exercises, self-assessed for free-text ones
- Section tabs preserve your answers when switching between sections

## Exams included

| File | Subject | Exam ID | Session |
|------|---------|---------|---------|
| `exams/italian_571282.json` | Italian | 571282 | Summer 2025 |

## Adding a new exam

1. Export the exam questions and answers as a JSON file matching the structure of an existing file in `exams/`
2. Drop the file into the `exams/` folder and push
3. It will automatically appear on the site — no code changes needed

## Deploying to GitHub Pages

1. Go to **Settings → Pages** in this repository
2. Set **Source** to the branch containing these files, root `/`
3. Save — the site will be live at `https://shner-elmo.github.io/israeli-bagrut-test/`

> The app uses the GitHub Contents API to discover exam files, so it only works when served from GitHub Pages (not opened as a local `file://` URL).

## JSON structure

Each exam file lives at `exams/<name>.json` and follows this top-level shape:

```json
{
  "exam": {
    "subject": "Italian (אִיטַלְקִית)",
    "exam_id": 571282,
    "session": "Summer 2025 (קיץ תשפ\"ה)",
    "duration_hours": 2.5,
    "total_points": 100,
    "sections": [ ... ]
  }
}
```

Each section contains one or more exercises. Exercise types are detected automatically:
- Has `word_bank` → cloze
- Has `tense` → verb fill-in-the-blank
- Questions have `underlined_part` → question formulation
- Otherwise → reading comprehension / free text
