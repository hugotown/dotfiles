---
name: gemini-text-to-speech
description: Converts text to expressive audio using Gemini TTS Python SDK. Supports single-speaker and multi-speaker (up to 2), 30 prebuilt voices, controllable style/accent/pace/tone via natural language. Auto-plays audio by default. Use when the user asks for text-to-speech, voice generation, audio narration, podcast creation, audiobook generation, or reading text aloud.
user-invocable: false
---

# Gemini Text-to-Speech (TTS)

Generate expressive audio from text via Gemini Python SDK (`google-genai`). Supports single-speaker and multi-speaker output with fine-grained control over style, accent, pace, and tone through natural language prompts.

**Prerequisite:** GEMINI_API_KEY must be validated by the parent `gemini` skill before proceeding. Include the client boilerplate from the parent skill at the top of every script.

## Step 1: Select Model

| Model | ID | Best For |
|-------|----|----------|
| **Flash TTS** | `gemini-2.5-flash-preview-tts` | Speed, high-volume, low-latency TTS. |
| **Pro TTS** | `gemini-2.5-pro-preview-tts` | Higher quality, more nuanced performances. |

**Default:** Use `gemini-2.5-flash-preview-tts` for all requests. Switch to `gemini-2.5-pro-preview-tts` if the user explicitly requests higher quality or more nuanced delivery.

Both models support single-speaker and multi-speaker (up to 2 speakers).

## Step 2: Determine Operation Type

| Operation | Description |
|-----------|-------------|
| **Single-speaker** | One voice reads the text. Requires `VoiceConfig` with `PrebuiltVoiceConfig`. |
| **Multi-speaker** | Up to 2 speakers in a conversation. Requires `MultiSpeakerVoiceConfig` with named speakers matching the transcript. |

## Step 3: Choose Voice

Pick a voice from the 30 prebuilt options. Match the voice character to the desired tone:

| Voice | Character | Voice | Character | Voice | Character |
|-------|-----------|-------|-----------|-------|-----------|
| Zephyr | Bright | Puck | Upbeat | Charon | Informative |
| Kore | Firm | Fenrir | Excitable | Leda | Youthful |
| Orus | Firm | Aoede | Breezy | Callirrhoe | Easy-going |
| Autonoe | Bright | Enceladus | Breathy | Iapetus | Clear |
| Umbriel | Easy-going | Algieba | Smooth | Despina | Smooth |
| Erinome | Clear | Algenib | Gravelly | Rasalgethi | Informative |
| Laomedeia | Upbeat | Achernar | Soft | Alnilam | Firm |
| Schedar | Even | Gacrux | Mature | Pulcherrima | Forward |
| Achird | Friendly | Zubenelgenubi | Casual | Vindemiatrix | Gentle |
| Sadachbia | Lively | Sadaltager | Knowledgeable | Sulafat | Warm |

**Default voice:** `Kore` (Firm). For complete voice details, read `voices.md` in this skill directory.

## Step 4: Generate Audio

### Single-Speaker

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents="Say cheerfully: Have a wonderful day!",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
            )
        ),
    ),
)
```

### Multi-Speaker (up to 2)

Speaker names in `speaker_voice_configs` MUST match the names used in the transcript text.

```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents="TTS the following conversation between Joe and Jane:\nJoe: How is it going today Jane?\nJane: Not too bad, how about you?",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="Joe",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                        ),
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="Jane",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                        ),
                    ),
                ]
            )
        ),
    ),
)
```

## Step 5: Process Response — Auto-Play by Default

**Default behavior:** Play audio automatically and delete the temp file. Only save if the user explicitly requests it.

### Auto-Play (default)

```python
import wave, tempfile, subprocess, sys, platform

data = response.candidates[0].content.parts[0].inline_data.data

# Write WAV to temp file
tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
with wave.open(tmp.name, "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(24000)
    wf.writeframes(data)

# Play audio
if platform.system() == "Darwin":
    subprocess.run(["afplay", tmp.name])
else:
    subprocess.run(["aplay", tmp.name])

# Delete temp file
import os
os.unlink(tmp.name)
print("Audio played successfully.")
```

### Save to File (only when user requests)

**Default save directory:** `./gemini-skill/audio/` (relative to the current project). Use a different path only if the user specifies one.

```python
import wave, os
from datetime import datetime

data = response.candidates[0].content.parts[0].inline_data.data

output_dir = "./gemini-skill/audio"
os.makedirs(output_dir, exist_ok=True)
ts = datetime.now().strftime("%Y%m%d-%H%M%S")
path = f"{output_dir}/tts-{ts}.wav"

with wave.open(path, "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(24000)
    wf.writeframes(data)

print(f"Audio saved: {path}")
```

When saving, **remind the user** to add `gemini-skill/` to `.gitignore` if not already present.

## Step 6: Ask User for Next Action

After generating, offer:
- Regenerate with a different voice
- Adjust style/pace/accent
- Switch to multi-speaker
- Generate new audio

## Prompting Best Practices

- **Style control:** Prefix text with direction: `Say cheerfully:`, `In a whisper:`, `With excitement:`
- **Multi-speaker:** Name speakers in the transcript and match them in config
- **Detailed direction:** Use Audio Profile + Scene + Director's Notes for complex performances
- **Accent control:** Be specific: "British English as heard in Croydon" not just "British accent"
- **Pacing:** Simple (`Speak slowly`) to complex (`A liquid, unhurried drift between words`)

For detailed prompting strategies (Audio Profile, Scene, Director's Notes), read `prompting-guide.md` in this skill directory.
For complete Python examples, read `examples.md` in this skill directory.

## Important Notes

- TTS models accept **text-only input** and produce **audio-only output**
- Context window limit: 32k tokens
- Audio output: PCM s16le, 24000 Hz, mono — saved as WAV via Python `wave` module (no ffmpeg needed)
- Language is auto-detected from input text. 73+ languages supported.
- Preview feature: capabilities may change
