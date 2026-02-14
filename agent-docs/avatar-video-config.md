# Avatar Video Configuration

## Video Assets

### Compressed Videos (Production Ready)

- **Idle Loop**: `sam-raw/avatar/idle-compressed.mp4` (0.78 MB)
- **Thinking Loop**: `sam-raw/avatar/thinking-compressed.mp4` (1.25 MB)

---

## Thinking Video Configuration

The thinking video is a single 30-second video containing 6 different thinking animations stitched together. Instead of loading 6 separate files, the frontend randomly seeks to one of the predefined entry points.

### Thinking Entry Points (Timestamps)

```javascript
const thinkingSegments = [
  { name: 'segment-1', start: 0 },   // 0s - Head scratch or first animation
  { name: 'segment-2', start: 7 },   // 7s - Notebook writing or second animation
  { name: 'segment-3', start: 14 },  // 14s - Eyes closed or third animation
  { name: 'segment-4', start: 21 }   // 21s - Pulsing glow or fourth animation
];
```

### Implementation Example

```javascript
// When thinking state is triggered
function startThinking(videoElement) {
  const randomSegment = thinkingSegments[Math.floor(Math.random() * thinkingSegments.length)];
  videoElement.currentTime = randomSegment.start;
  videoElement.play();
}
```

### Benefits

- Only 1 video file to load (1.25 MB vs 6+ MB for separate files)
- Reduces HTTP requests
- Lower memory overhead
- Still provides visual variety through random entry points

---

## Video Specifications

All videos are compressed with:
- Resolution: 1280x720 (16:9 aspect ratio)
- Codec: H.264 (libx264)
- CRF: 28 (quality setting)
- Audio: AAC 96 kbps
- Preset: slow (better compression efficiency)

---

## Future Assets (To Be Created)

### Listening Loop
- Duration: ~4 seconds
- State: Active listening while user speaks

### Speaking Loop
- Duration: ~3 seconds
- Main talking animation with mouth movement
- First frame: neutral closed mouth position

### Phoneme Transition Clips (6 videos)
- Duration: 0.5 seconds each
- Purpose: Bridge from specific phoneme to speaking loop
- Types:
  - MBP (closed lips)
  - TDNL (small open)
  - AHAA (wide open)
  - OUW (rounded)
  - EE (smile spread)
  - FV (teeth/lip contact)

---

## Mastra Integration Notes

### State Flow

1. **Idle** → User starts speaking → **Listening**
2. **Listening** → User finishes → Random **Thinking** segment (seek to random timestamp)
3. **Thinking** → LLM responds with phoneme tag → **Phoneme Transition** (matching tag)
4. **Phoneme Transition** → Seamlessly flows into → **Speaking Loop**
5. **Speaking Loop** → Continues while TTS plays → Back to **Idle**

### WebSocket Events (Suggested)

```javascript
// Thinking state
{
  type: 'avatar.thinkingStart',
  segment: 'segment-2',  // which timestamp was selected
  timestamp: 7
}

// Speaking state
{
  type: 'avatar.speakingStart',
  phoneme: 'OUW',
  clip: 'phoneme-ouw'
}
```

---

## Compression Command Reference

For future video compression:

```powershell
ffmpeg -i "input.mp4" -c:v libx264 -preset slow -crf 28 -c:a aac -b:a 96k "output-compressed.mp4"
```

This typically achieves 90-95% file size reduction while maintaining good visual quality.
