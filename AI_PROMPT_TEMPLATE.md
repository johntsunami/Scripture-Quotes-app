# How to ask an AI to generate quotes for Quotes

Paste this template into Claude (or any AI) and replace the **bold** parts:

---

> Generate **500** quotes on **financial education / investing / wealth-building**, formatted as a valid JSON array suitable for direct import. Use this exact schema, no extra fields:
>
> ```json
> [
>   {
>     "text": "The quote itself.",
>     "source": "Attribution — author name, or book/scripture reference.",
>     "category": "financial",
>     "tags": ["investing", "wealth"]
>   }
> ]
> ```
>
> Rules:
> - `text` is required. Keep each quote under 200 characters where possible — they need to fit in a popup.
> - `source` is required. Use real attributions; if unknown, write "Anonymous" rather than inventing.
> - `category` should be `"financial"` for every quote in this batch (single-category batches make filtering easier).
> - `tags` is optional. Use 1–3 lowercase tags per quote.
> - Output only the JSON array. No preamble, no markdown fences, no commentary.
> - All quotes must be genuine and historically attributable. Do not fabricate authors or sources.

---

## Tips

- **One category per batch.** Easier to manage. Run the prompt three times for "scripture", "motivation", "financial" rather than asking for one mixed batch.
- **Sanity-check before pasting** — open the AI's output, scroll to the bottom, make sure it's a closed `]` and not truncated mid-quote.
- **Drag the .json file** onto the Quotes import box instead of pasting, if the batch is huge.
- **Duplicates are auto-skipped.** Same `text + source` combo won't be imported twice, so it's safe to re-import a batch you're not sure went through.

## Common categories to consider

| category       | use for                                                        |
|----------------|----------------------------------------------------------------|
| `scripture`    | Bible verses, religious texts                                  |
| `motivation`   | Discipline, perseverance, mindset                              |
| `financial`    | Investing, wealth-building, money mindset                      |
| `wisdom`       | Classic philosophy, proverbs                                   |
| `leadership`   | Management, influence, decision-making                         |
| `relationships`| Love, family, friendship, communication                        |
| `health`       | Fitness, nutrition, mental wellness                            |
| `nclex`        | Phase 2 — multiple-choice nursing review (different schema)    |

Keep category names lowercase, single words where possible.
