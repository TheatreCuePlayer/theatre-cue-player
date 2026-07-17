# Theatre Cue Player Manual
**Version 0.8.1 | July 22, 2025**

*Educational audio cue management for theatre arts instruction*  
*Designed by Kevin Patrick, Blinn College-Brenham Campus*

---

## Educational Purpose

Theatre Cue Player is designed primarily as a **teaching tool** for audio cue management in educational theatre programs. It provides a Chromebook-friendly, internet-free solution that allows students to learn professional audio cueing concepts without expensive software or complex installations. While capable of live performance use, its educational design prioritizes learning, safety, and accessibility over advanced professional features.

### Key Educational Benefits
- **No Internet Required**: Works completely offline once loaded
- **Chromebook Compatible**: Designed for standard educational devices
- **Student-Safe Design**: Help mode and undo features prevent costly mistakes
- **Everything Visible**: All parameters displayed for learning transparency
- **Professional Concepts**: Teaches industry-standard workflows and terminology

---

## Quick Start Guide

### First Time Setup
1. **Open** theatre-cue-player.html in Chrome, Firefox, or Safari
2. **Click** "Tutorial" for guided first-time setup, OR:
3. **Click** "Load Audio Folder" → Select folder with your audio files
4. **Click** "Load Cue File" → Select existing .json cue file, OR "New Project"
5. **Press** spacebar or click "GO" to run your first cue

### Basic Operation
- **Show Mode**: Default performance mode with GO button and safety controls
- **Edit Mode**: Click "Edit Mode" to modify cues (yellow warning state)
- **Help**: Press F1 or click "HELP" for safe exploration mode
- **Emergency**: "STOP ALL" button stops everything immediately

---

## User Flow Chart

```
START
  ↓
WELCOME SCREEN
  ↓
First Time? → [YES] → Tutorial → Load Files → Test Cue → Ready!
  ↓           [NO]
Choose Action:
  ├─ Load Audio Folder → Browse Files → Confirm Selection
  ├─ Load Cue File → Select .json → Match to Audio
  └─ New Project → Empty Cue List
  ↓
MAIN INTERFACE
  ↓
Learning Mode? → [YES] → Help Mode → Explore Safely → Practice
  ↓             [NO]
Performance Mode → GO Button → Run Show
  ↓
Edit Mode → Add/Edit Cues → Waveform Editor → Save Project → Show Mode
```

---

## Core Features

### A. File Management
- **Audio Folder Loading**: Recursively scans subfolders for audio files
- **Cue File System**: .json files store cue lists independently from audio
- **Supported Formats**: MP3, WAV, OGG, M4A, AAC, FLAC
- **File Independence**: Audio library separate from show-specific cue files

### B. Cue Types
1. **Audio Cues**: Play audio files with timing controls
2. **Fade Cues**: Adjust volume and pan/balance of running audio over time

### C. Show Mode Features (Performance)
- **GO Button**: Primary advance control (spacebar shortcut)
- **Individual Controls**: Fade or stop any running cue independently
- **Emergency Stop**: "STOP ALL" button for immediate silence
- **Assignable Hot Keys**: Custom F-key shortcuts for specific cues
- **Progress Tracking**: Visual feedback for running cues
- **Next Cue Display**: Shows upcoming cue information
- **Student Safety**: Individual cue control prevents common operator errors

### D. Edit Mode Features (Learning/Setup)
- **Add/Delete Cues**: Build and modify cue sequences
- **Inline Editing**: Click any field to edit directly
- **Reorder Cues**: Click arrow buttons to move cues up/down in sequence
- **File Assignment**: Change target audio files per cue
- **Waveform Editor**: Visual audio editing with start/end point selection
- **Timing Controls**: Set fade in/out, start/end times, delays, pan/balance
- **Volume Controls**: Master and per-cue volume adjustment
- **Automation**: Auto Continue (immediate), Auto Follow (after completion)

### E. Help & Learning System
- **Tutorial Mode**: Guided first-time user setup
- **Context Help**: Click ❓ icons for feature explanations
- **Safe Exploration**: Help mode disables actions for training
- **Educational Language**: Theatre terminology with clear explanations

---

## Educational Workflow Guide

### Classroom Setup
1. **Prepare Audio Library**: Organize class audio files in shared folder
2. **Student Introduction**: Use Tutorial mode for first-time students
3. **Practice Projects**: Create template cue files for exercises
4. **Learning Mode**: Use Help system for safe exploration

### Student Learning Process
1. **Load Example Files**: Start with pre-built audio folder and cue file
2. **Explore Interface**: Use Help mode (F1) to learn features safely
3. **Edit Practice**: Modify existing cues to understand parameters
4. **Create New**: Build original cue sequences from scratch
5. **Waveform Editing**: Learn audio trimming and timing concepts

### Assessment Preparation
1. **Student Performance**: Practice running cues in Show Mode
2. **Error Recovery**: Learn individual cue control for mistake correction
3. **Hot Key Setup**: Assign frequently-used cues to F-keys
4. **Documentation**: Save and organize student project files

### Performance Mode (Advanced Students)
1. **System Preparation**: Turn off system sounds, disable internet, close other apps
2. **Audio Check**: Test all outputs and levels before audience
3. **Distraction-Free**: Use F11 fullscreen mode during performance
4. **Focus Setup**: Only essential controls visible in Show Mode
5. **Safety Net**: Individual cue controls for real-time corrections

---

## Keyboard Shortcuts

| Key | Action | Mode | Educational Use |
|-----|--------|------|-----------------|
| **Spacebar** | GO (advance to next cue) | Show | Primary control for performance |
| **F1** | Toggle Help | Both | Safe learning exploration |
| **F11** | Browser fullscreen | Both | Distraction-free performance |
| **Escape** | Stop current cue | Both | Emergency stop individual cue |
| **Enter** | Confirm edit | Edit | Complete field editing |
| **Tab** | Navigate fields | Edit | Move between editable fields |
| **F2-F12** | Assignable Hot Keys | Show | Custom cue shortcuts (set in Edit) |

---

## Technical Requirements

### Educational Environment Specs
- **Browser**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **Chromebook**: Optimized for 1366x768 standard educational displays
- **Network**: No internet required after initial file loading
- **Memory**: 4GB RAM minimum (standard on educational Chromebooks)
- **Storage**: Local files only - no cloud dependencies

### Audio File Guidelines for Education
- **Format**: MP3 (320kbps) recommended for size/quality balance
- **Organization**: Clear folder structure for shared class libraries
- **Naming**: Descriptive filenames for easy student identification
- **Size**: Keep under 10MB per file for Chromebook performance
- **Backup**: Maintain copies on school network storage

### Classroom Network Considerations
- **Offline Operation**: Load files once, then disconnect if needed
- **Shared Storage**: Audio libraries on network drives work well
- **Individual Projects**: Student cue files saved to local storage
- **File Security**: Browser-based file access respects school security policies

---

## Troubleshooting for Educators

### Common Student Issues

**Q: "Tutorial button doesn't appear"**
**A:** Student has used TCP before - tutorial only shows to new users. Click HELP (F1) for guided exploration instead.

**Q: "I clicked GO twice and messed up the show"**
**A:** Use individual cue fade/stop buttons to fix running cues. This is why TCP includes these controls that other software lacks.

**Q: "My audio files disappeared"**
**A:** Files still exist - click "Load Audio Folder" again to reconnect. Cue files and audio are separate for flexibility.

**Q: "Help mode is stuck"**
**A:** Click "EXIT HELP" button. Help mode intentionally disables actions for safe learning.

**Q: "Waveform editor won't open"**
**A:** Must be in Edit Mode first. Click "Edit Mode" then try opening waveform editor.

### Classroom Management
- **File Organization**: Establish consistent folder naming for class projects
- **Version Control**: Have students save multiple versions with dates
- **Sharing Work**: Cue files (.json) can be shared; audio folders must be accessible to all
- **Assessment**: Use project file analysis to evaluate student understanding

---

## Glossary

### Educational Theatre Terms
- **Audio Cue**: A numbered instruction to play specific audio at a specific time
- **Cue Sequence**: The ordered list of all audio events in a production
- **GO**: The standard theatre command to execute the next cue (spacebar in TCP)
- **Hot Key**: Programmable shortcut key for immediate cue access
- **Operator**: Student or person responsible for running audio cues during performance

### Audio Technical Terms
- **Auto Continue**: Next cue starts immediately when current cue begins (0-second delay)
- **Auto Follow**: Next cue starts when current cue finishes playing
- **Duration**: How long audio plays (can be shorter than file length)
- **Fade In/Out**: Gradual volume change at beginning/end of cue
- **Pan/Balance**: Left-right audio positioning
- **Start/End Time**: Specific points within audio file for playback
- **Waveform**: Visual representation of audio showing peaks and quiet sections

### Software Interface Terms
- **Edit Mode**: Interface state allowing cue creation and modification
- **Help Mode**: Safe exploration mode that disables all actions
- **Show Mode**: Performance interface with simplified controls
- **Cue List**: Table showing all cues in performance order
- **Individual Cue Control**: Ability to fade or stop specific running cues
- **File Independence**: Audio library separate from cue list storage

---

## Support & Updates

**Educational Contact**: kevin.patrick@blinn.edu  
**License**: MIT (free for educational use, modification, and distribution)  
**Source Code**: github.com/kevin-patrick/theatre-cue-player  
**Educator Network**: [Join educator beta testing](https://forms.gle/JNS7qw5vzpr4eX5BA)

**Built-in Learning**: Press F1 for context-sensitive help system  
**New Student Tutorial**: Automatic guided setup for first-time users  
**Teacher Resources**: Contact for lesson plans and assessment rubrics

---

*Designed specifically for educational theatre programs using Chromebooks and other standard classroom technology. Professional features included to teach industry-standard concepts while maintaining student-safe operation.*