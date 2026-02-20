# TTS Prompting Guide

## Core Principle

Gemini TTS knows **not only what to say, but how to say it**. Think of yourself as a director setting a scene for a virtual voice talent.

## Prompt Structure

A robust TTS prompt includes up to 5 elements:

1. **Audio Profile** - Persona: name, role, character archetype
2. **Scene** - Environment, mood, what's happening around the character
3. **Director's Notes** - Style, pacing, accent, breathing, articulation
4. **Sample Context** - Contextual starting point for natural entry
5. **Transcript** - The actual text to speak

You don't need all 5 elements. At minimum, provide **Director's Notes** + **Transcript**.

## Simple Prompts

### Emotion prefix

```
Say cheerfully: Have a wonderful day!
```

### Whisper

```
Say in a spooky whisper:
"By the pricking of my thumbs...
Something wicked this way comes"
```

### Multi-speaker direction

```
Make Speaker1 sound tired and bored, and Speaker2 sound excited and happy:

Speaker1: So... what's on the agenda today?
Speaker2: You're never going to guess!
```

## Full Prompt Template

```
# AUDIO PROFILE: [Name]
## "[Role/Title]"

## THE SCENE: [Location]
[Describe environment, time, mood, what's happening]

### DIRECTOR'S NOTES
Style: [Tone, energy, vocal characteristics]
Pace: [Speed, rhythm, cadence]
Accent: [Specific regional accent]

### SAMPLE CONTEXT
[Brief context for the character's situation]

#### TRANSCRIPT
[The text to be spoken]
```

## Full Prompt Example

```
# AUDIO PROFILE: Jaz R.
## "The Morning Hype"

## THE SCENE: The London Studio
It is 10:00 PM in a glass-walled studio overlooking the moonlit London skyline,
but inside, it is blindingly bright. The red "ON AIR" tally light is blazing.
Jaz is standing up, bouncing on the balls of their heels to the rhythm of a
thumping backing track.

### DIRECTOR'S NOTES
Style:
* The "Vocal Smile": You must hear the grin in the audio. Bright, sunny, inviting.
* Dynamics: High projection without shouting. Punchy consonants and elongated
  vowels on excitement words (e.g., "Beauuutiful morning").

Pace: Energetic, fast. A "bouncing" cadence. High-speed delivery with fluid
transitions, no dead air.

Accent: Jaz is from Brixton, London

### SAMPLE CONTEXT
Jaz is the industry standard for Top 40 radio. Infectious energy at 11/10.

#### TRANSCRIPT
Yes, massive vibes in the studio! You are locked in and it is absolutely
popping off in London right now. If you're stuck on the tube, or just sat
there pretending to work... stop it. Seriously, I see you. Turn this up!
```

## Director's Notes Deep Dive

### Style

Controls tone and delivery. Be descriptive:

**Simple:** `Style: Frustrated and angry`

**Better:** `Style: Sassy GenZ beauty YouTuber for YouTube Shorts`

**Complex:**
```
Style:
* The "Vocal Smile": hear the grin. Soft palate raised, bright and inviting.
* Dynamics: High projection without shouting. Punchy consonants.
```

### Accent

Be as specific as possible:

**Vague:** `British accent` (too broad)

**Specific:** `British English as heard in Croydon, England`

**Best:** `Southern California valley girl from Laguna Beach`

### Pacing

**Simple:** `Speak as fast as possible`

**Medium:** `Speaks at an energetic pace, keeping up with fast paced music`

**Complex:** `The "Drift": incredibly slow and liquid. Words bleed into each other. Zero urgency.`

## Tips

- Keep the transcript topic aligned with the direction you're giving
- Don't overspecify — too many rules limit the model's natural performance
- Use voice options that complement the style (e.g., Enceladus for "breathy/tired")
- Have Gemini help build your prompt — give it a blank template and ask it to sketch a character
- For podcasts: generate transcript with a regular Gemini model first, then pass to TTS
