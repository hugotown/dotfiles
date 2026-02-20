# Model Reference

## Nano Banana (gemini-2.5-flash-image)

- Optimized for speed and high-volume tasks
- 1K output resolution only (1024x1024 at 1:1)
- Max 3 input images
- 1290 output tokens per image
- No Google Search grounding
- No configurable resolution

### Resolution Table

| Aspect Ratio | Resolution | Tokens |
|---|---|---|
| 1:1 | 1024x1024 | 1290 |
| 2:3 | 832x1248 | 1290 |
| 3:2 | 1248x832 | 1290 |
| 3:4 | 864x1184 | 1290 |
| 4:3 | 1184x864 | 1290 |
| 4:5 | 896x1152 | 1290 |
| 5:4 | 1152x896 | 1290 |
| 9:16 | 768x1344 | 1290 |
| 16:9 | 1344x768 | 1290 |
| 21:9 | 1536x672 | 1290 |

## Nano Banana Pro (gemini-3-pro-image-preview)

- Professional asset production
- 1K, 2K, and 4K output resolution
- Up to 14 input images (6 objects + 5 humans max)
- Advanced text rendering (legible, stylized text)
- Google Search grounding for real-time data
- Thinking mode (enabled by default, cannot be disabled)
- Generates up to 2 interim "thought images" before final output
- Thought signatures required for multi-turn conversations

### Resolution Table

| Aspect Ratio | 1K | 2K | 4K |
|---|---|---|---|
| 1:1 | 1024x1024 | 2048x2048 | 4096x4096 |
| 2:3 | 848x1264 | 1696x2528 | 3392x5056 |
| 3:2 | 1264x848 | 2528x1696 | 5056x3392 |
| 3:4 | 896x1200 | 1792x2400 | 3584x4800 |
| 4:3 | 1200x896 | 2400x1792 | 4800x3584 |
| 4:5 | 928x1152 | 1856x2304 | 3712x4608 |
| 5:4 | 1152x928 | 2304x1856 | 4608x3712 |
| 9:16 | 768x1376 | 1536x2752 | 3072x5504 |
| 16:9 | 1376x768 | 2752x1536 | 5504x3072 |
| 21:9 | 1584x672 | 3168x1344 | 6336x2688 |

### Token Cost

| Resolution | Tokens |
|---|---|
| 1K | 1120 |
| 2K | 1120 |
| 4K | 2000 |

## Decision Matrix

**Default model: Nano Banana Pro (`gemini-3-pro-image-preview`)**. Only use Nano Banana when explicitly requested for speed.

| Need | Use |
|---|---|
| Fast generation, high volume | Nano Banana |
| High resolution (2K/4K) | Nano Banana Pro |
| Accurate text rendering | Nano Banana Pro |
| Real-time data (weather, news) | Nano Banana Pro + Search |
| Simple text-to-image | Nano Banana |
| Complex multi-image composition | Nano Banana Pro |
| Professional product shots | Nano Banana Pro |
| Icons, stickers, assets | Nano Banana |
| Infographics, diagrams | Nano Banana Pro |
| Character consistency (360 view) | Nano Banana Pro |
