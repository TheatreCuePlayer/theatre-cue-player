# Theatre Cue Player Manual
**Version 1.1 | July 2026**

*Professional Audio Cue Management for Educational Theatre*

---

## Overview
Theatre Cue Player is a professional-grade audio playback tool designed specifically for educational theatre. It combines industry-standard cueing capabilities with student-safe features, allowing schools to run complex sound designs using standard Chromebooks or laptops without internet access.

## Quick Start
1. **Open** the HTML file in Chrome, Edge, or Firefox.
2. **Click "Load Audio Folder"** and select the folder containing your sound files. 
   - *Note: You must select the top-level folder. The player will automatically scan all subfolders.*
   - *Note: If someone has sent you a Show Package (Zip), click "Load Project Zip" instead and skip to step 4. The cue list and its audio open together.*
3. **Add Cues** by clicking "Add Audio Cue" or pressing `A` in Edit Mode.
4. **Press Spacebar** (GO) to play cues.

---

## Core Features

### Audio Playback
- **Multiple Instances**: Overlap sounds (e.g., rain background + thunder clap) seamlessly.
- **Unified Control**: "Stop All" and "Fade All" buttons control every active sound instantly.
- **Waveform Editor**: Visually edit start/end points and fade curves.
- **Formats**: Supports MP3, WAV, OGG, M4A, AAC, and FLAC.

### Edit Mode
- **Undo/Redo**: Comprehensive history (Ctrl+Z / Ctrl+Y) for all edits.
- **Drag-and-Drop**: Reorder cues easily.
- **Renumbering**: Smart renumbering (1, 2, 3...) or decimal insertion (1.1, 1.2).
- **Validation**: Visual warnings if an assigned audio file is missing.

### Automation
- **Auto-Continue (0s)**: Next cue starts immediately with the current cue.
- **Auto-Follow**: Next cue starts automatically when the current cue finishes.
- **Loops**: Set cues to loop 1x, 2x, or Infinite (∞).

---

## Keyboard Shortcuts

| Key | Action | Mode |
|-----|--------|------|
| **Spacebar** | **GO** (Play Next Cue) | Show |
| **Esc** | Stop All / Stop Selected | Both |
| **~ (Tilde)** | Stop All | Both |
| **F** | Add **F**ade Cue | Edit |
| **A** | Add **A**udio Cue | Edit |
| **Ctrl + Z** | Undo | Edit |
| **Ctrl + Y** | Redo | Edit |
| **F1** | Toggle Help Mode | Both |

---

## Waveform Editor
Click the **Waveform** button on any audio cue to open the editor.
- **Zoom**: Scroll wheel to zoom in/out.
- **Trim**: Drag the Red (Out) and Green (In) handles.
- **Fades**: Drag the Fade In/Out handles to create S-curve fades.

---

## Educational & Safety Features
- **Offline First**: Runs locally on the device (no internet needed after loading).
- **Help Mode**: Press F1 to enter a "safe mode" where students can click items to learn what they do without changing the show.
- **Project Saving**: Save your entire cue list (not audio files) as a `.json` file to resume work later.
- **Load Project Zip**: Open a Show Package (Zip) in one step. The cue list and every audio file it uses open together, so there is no need to load an audio folder as well — ideal for handing a show to a student or collecting one back.
    - *Note: If the Zip has no cue list inside it (e.g., a folder of sound effects), the player offers to add its audio files to your current project instead, leaving your cues untouched.*
- **Export Center**: 
    - **Cue Sheets**: Export your cue list as a **PDF** (printable) or **CSV** (Excel/Sheets) for stage managers and technicians.
    - **Show Package (Zip)**: Export a bundle containing your `.json` cue file, your Cue Sheets (when "Include Cue Sheets" is ticked), and **every audio file your cues use**, in a portable Zip.
    - *Note: Cue Sheets and Zip packages are built on your own device. No internet connection is required.*

---

## Support
**Email:** TheatreCuePlayer@gmail.com
**License:** Creative Commons BY-NC-ND 4.0 International
