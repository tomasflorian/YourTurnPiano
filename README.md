# MIDI Piano Handoff — v0

    python -m http.server 8000

Open <http://localhost:8000/> in Chrome or Edge, plug in the MIDI keyboard,
click Start, and grant MIDI permission when asked.

The computer plays Ode to Joy but stops at every player-owned note and waits
indefinitely. Wrong keys sound and do nothing; the correct key resumes the song.
Finishing the song advances a level, and each level hands over one more beat per
measure (P C C C -> P P C C -> P P P C -> P P P P).

**Hear preview** sounds the note the game is waiting for, without accepting it.
The song stays paused -- you still have to find the key yourself. The button is
live only while the game is waiting.

Computer-played notes always sound through the computer's speakers, and are also
sent to the piano when it appears as a MIDI output. Player key presses are voiced
by the piano itself (or synthesized, if there is no MIDI output).
