# Complete TTS Python SDK Examples

All examples use `google-genai` SDK. Include the client boilerplate (API key loading + `genai.Client`) before running.

## Client Boilerplate

```python
import os, sys

api_key = None
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            if line.startswith('GEMINI_API_KEY='):
                api_key = line.split('=', 1)[1].strip().strip('"').strip("'")
                break
if not api_key:
    api_key = os.environ.get('GEMINI_API_KEY')
if not api_key:
    print("ERROR: GEMINI_API_KEY not found.")
    sys.exit(1)

from google import genai
from google.genai import types

client = genai.Client(api_key=api_key)
```

## Helpers

### Auto-Play Helper (default behavior)

```python
import wave, tempfile, subprocess, platform

def play_response(response):
    data = response.candidates[0].content.parts[0].inline_data.data
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    with wave.open(tmp.name, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(24000)
        wf.writeframes(data)
    if platform.system() == "Darwin":
        subprocess.run(["afplay", tmp.name])
    else:
        subprocess.run(["aplay", tmp.name])
    os.unlink(tmp.name)
    print("Audio played successfully.")
```

### Save Helper (when user requests saving)

```python
import wave
from datetime import datetime

def save_response(response, output_dir="./gemini-skill/audio"):
    data = response.candidates[0].content.parts[0].inline_data.data
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

## Single-Speaker

### Basic

```python
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
play_response(response)
```

### With Style Direction

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents="Say in a spooky whisper: By the pricking of my thumbs... Something wicked this way comes",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Enceladus")
            )
        ),
    ),
)
play_response(response)
```

### With Full Audio Profile

```python
prompt = """# AUDIO PROFILE: Jaz R.
## The Morning Hype

## THE SCENE: The London Studio
It is 10:00 PM in a glass-walled studio. The red ON AIR tally light is blazing. Jaz is standing up, bouncing on the balls of their heels.

### DIRECTORS NOTES
Style: The Vocal Smile. You must hear the grin. Bright, sunny, inviting.
Pace: Energetic, fast. A bouncing cadence. No dead air.
Accent: Jaz is from Brixton, London

#### TRANSCRIPT
Yes, massive vibes in the studio! You are locked in and it is absolutely popping off in London right now. If you are stuck on the tube, turn this up!"""

response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
            )
        ),
    ),
)
play_response(response)
```

### Pro Model (higher quality)

```python
response = client.models.generate_content(
    model="gemini-2.5-pro-preview-tts",
    contents="Read with warmth and gravitas: In the beginning, there was silence. Then, a single note rang out across the void, and everything changed.",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Sulafat")
            )
        ),
    ),
)
play_response(response)
```

## Multi-Speaker

### Basic Conversation

```python
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
play_response(response)
```

### With Style Direction per Speaker

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents="Make Speaker1 sound tired and bored, and Speaker2 sound excited and happy:\n\nSpeaker1: So... what is on the agenda today?\nSpeaker2: You are never going to guess!",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="Speaker1",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Enceladus")
                        ),
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="Speaker2",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                        ),
                    ),
                ]
            )
        ),
    ),
)
play_response(response)
```

## Two-Step: Generate Transcript then TTS

For podcasts or long content, first generate a transcript with a regular Gemini model, then pass to TTS:

```python
# Step 1: Generate transcript
transcript_response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Generate a short podcast transcript (~100 words) between Dr. Anya and Liam about excited herpetologists discovering a new species.",
)
transcript = transcript_response.text

# Step 2: Convert transcript to audio
response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents=transcript,
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=[
                    types.SpeakerVoiceConfig(
                        speaker="Dr. Anya",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                        ),
                    ),
                    types.SpeakerVoiceConfig(
                        speaker="Liam",
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                        ),
                    ),
                ]
            )
        ),
    ),
)
play_response(response)
```

## Save Instead of Play

When the user wants to keep the audio file:

```python
response = client.models.generate_content(
    model="gemini-2.5-flash-preview-tts",
    contents="Say warmly: Welcome to the show, everyone!",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Sulafat")
            )
        ),
    ),
)
save_response(response)  # Saves to ./gemini-skill/audio/tts-YYYYMMDD-HHMMSS.wav
```
