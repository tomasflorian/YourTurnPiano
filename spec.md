MIDI PIANO HANDOFF GAME
Prototype Specification — Version 0

PURPOSE

Create the smallest possible experiment to test one game mechanic:

The computer performs a song automatically, but selected notes are withheld.

Whenever playback reaches a withheld note, playback stops indefinitely.

The player must find and press the exact correct key on a MIDI keyboard.

Wrong keys sound normally but do nothing to advance the song.

When the correct key is pressed, that note becomes part of the performance and the computer immediately continues playing until the next withheld note.

As difficulty increases, progressively more of the song is handed from the computer to the player.

There is no visual teaching component.

The feedback loop is entirely auditory:

wrong note -> hear wrong note -> nothing happens

correct note -> hear correct note -> song immediately continues

PLATFORM

Windows PC.

Chrome or Microsoft Edge.

Local web application served from localhost.

Web MIDI API used to receive MIDI keyboard input.

No server-side application is required.

No installation should be required beyond a trivial local HTTP server.

The application does not need internet access.

HARDWARE

USB MIDI keyboard or digital piano connected to Windows.

Exact MIDI note numbers must be used.

Octaves matter.

For example:

C3 is not accepted if C4 is expected.

Velocity does not matter.

Any Note On event with velocity greater than zero counts as a key press.

Note Off events do not affect game progression.

TEST SONG

Use one hardcoded song:

Ode to Joy
Simplified beginner melody
C major
4/4
Right hand only
Monophonic
Quantized
No pedal
No dynamics
No ornaments
No chords

Use only enough of the song to make the experiment useful. The first major section is sufficient; implementing an entire arrangement is unnecessary.

Do NOT implement MIDI-file loading in version 0.

Represent the song directly in JavaScript as a hardcoded sequence of note events.

Conceptually:

note
duration
player-or-computer

Example:

E4, quarter
E4, quarter
F4, quarter
G4, quarter
G4, quarter
F4, quarter
E4, quarter
D4, quarter
...

This deliberately eliminates MIDI-file parsing, track detection, tempo-map handling, hand detection, quantization and every other unrelated problem.

TEMPO

Hardcode a comfortable beginner tempo.

Approximately 70-90 BPM is appropriate.

Exact tempo is not important for the experiment.

Computer-controlled portions of the song play at normal tempo.

When a player-controlled note is reached, musical time stops completely.

There is no penalty for waiting.

The player may take:

0.5 seconds
5 seconds
30 seconds
2 minutes

to find the correct key.

Once the correct key is pressed, playback resumes immediately.

CORE PLAYBACK RULE

Each note event has one of two owners:

COMPUTER
PLAYER

For a COMPUTER note:

Play the note automatically for its specified duration.

Continue through the song according to tempo.

For a PLAYER note:

Stop progression before playing the note.

Do not play that note automatically.

Wait indefinitely for MIDI input.

For every incoming MIDI Note On:

If note != expected note:
allow the wrong note to be heard
remain stopped

If note == expected note:
accept it
resume the song
proceed to the next event

The player's physical key press supplies the missing note.

The computer must not also play a duplicate copy of the correct note unless technically necessary for sound generation.

LEVEL MECHANIC

The important progression is:

computer owns most notes
->
player owns increasingly long contiguous portions
->
player owns entire song

Do NOT distribute player notes evenly throughout the bar.

Prefer:

AXXX
ABXX
ABCX
ABCD

rather than:

AXXX
AXBX
XABX
etc.

The objective is to teach progressively longer physical/musical sequences.

FIRST LEVEL STRUCTURE

For the prototype, divide the melody into 4/4 measures.

Treat the first portion of each measure as the player's responsibility.

Conceptually, for a four-quarter-note measure:

Level 1:

P C C C

Player plays first note.
Computer plays remaining three.

Level 2:

P P C C

Player plays first two notes consecutively.
Computer plays remaining two.

Level 3:

P P P C

Player plays first three.

Level 4:

P P P P

Player plays the entire measure.

Apply the same ownership pattern to every measure.

Example:

Level 1

| P C C C | P C C C | P C C C | P C C C |

Level 2

| P P C C | P P C C | P P C C | P P C C |

Level 3

| P P P C | P P P C | P P P C | P P P C |

Level 4

| P P P P | P P P P | P P P P | P P P P |

IMPORTANT RHYTHM RULE

Ownership should be based on musical time within the measure rather than simply "first N MIDI notes" where practical.

For version 0, however, the chosen melody should be simple enough that these are nearly equivalent.

Half notes and other longer notes should retain their proper duration.

The player is responsible only for triggering the correct note.

The player is NOT responsible for holding it for the correct duration in version 0.

Example:

Expected note is a half note.

Player taps correct key briefly.

The game accepts it and continues according to the song's predefined duration.

This intentionally separates:

finding/playing the correct sequence

from

performing rhythm accurately.

CRITICAL DESIGN PRINCIPLE

The computer controls musical time.

The player controls progression.

The game must therefore behave like:

computer plays...
computer plays...
STOP

player presses wrong note
wrong note sounds
still stopped

player presses another wrong note
wrong note sounds
still stopped

player presses correct note

song continues immediately...

computer plays...
computer plays...
STOP

This interaction is the prototype.

SOUND

Preferred implementation if the digital piano has its own sound engine:

Player key presses produce their normal sound locally on the piano.

Computer-controlled notes are sent through Web MIDI Output back to the piano so that the same piano produces both computer and human notes.

This is preferred because:

human and computer notes have identical sound
audio latency should be extremely small
no software piano synthesizer is required

If the MIDI device is input-only or cannot synthesize incoming MIDI:

Use Web Audio for sound generation.

For version 0, sound quality is unimportant. A basic synthesized tone or simple locally stored piano sample is sufficient.

Do not spend significant development effort on realistic piano synthesis.

LATENCY

Do not optimize latency prematurely.

There is no timing score and playback waits indefinitely.

Therefore MIDI input latency cannot cause the player to fail.

The only latency that matters is perceived response:

correct key pressed
->
song resumes

That transition should feel immediate.

For this prototype, browser/Web MIDI latency on a local Windows machine is expected to be entirely adequate.

If noticeable latency appears, measure it before considering a native application.

USER INTERFACE

No gameplay GUI is required.

No falling notes.
No keyboard diagram.
No sheet music.
No score.
No note name.
No "press C".
No progress bar.
No rhythm indicator.

The player learns exclusively through hearing and experimentation.

A minimal startup interface is acceptable solely to satisfy browser/device setup requirements:

Start

Optionally display:

MIDI input connected
MIDI output connected
Level number

These are diagnostics, not gameplay aids.

The browser may require the user to explicitly grant MIDI-device permission. Web MIDI access is permission-gated in modern Chromium browsers.

STARTING A GAME

On Start:

1. Request MIDI access.

2. Select the available MIDI input.

3. Select matching MIDI output if available.

4. Set Level 1.

5. Pause briefly.

6. Begin song playback.

If the first note is player-owned, the game simply waits silently for the player to discover it.

WRONG NOTES

Wrong notes must NOT be suppressed.

They are an important part of the learning mechanism.

The desired experience is:

"I don't know the note."

press key
wrong sound

press another
wrong sound

press another
wrong sound

press correct key
music takes off

A player must be allowed to brute-force the keyboard one key at a time if necessary.

That is not considered failure.

It is part of Level 1 learning.

RIGHT NOTES

When the player presses the expected MIDI note:

Accept immediately.

No timing check.

No velocity check.

No duration check.

No score.

No congratulatory sound.

No artificial feedback is necessary.

The continuation of the music IS the reward and confirmation.

LEVEL COMPLETION

When the song reaches the end:

Stop.

Advance to the next ownership level.

Restart the same song from the beginning.

Example:

Level 1 completed
->
Level 2 begins from beginning

The difference between levels should be immediately audible because the computer now supplies less of the song.

FINAL LEVEL

The final level assigns every melody event to the player.

The computer therefore plays nothing except any future accompaniment that might eventually be added.

Playback still waits indefinitely at every note.

The player has now progressed from:

occasionally triggering the song

to

performing the complete note sequence.

NOT INCLUDED IN VERSION 0

Do not implement:

MIDI file loading
arbitrary songs
automatic level generation
sheet music
falling-note visualization
note names
chords
left hand
accompaniment
pedal
velocity grading
note-duration grading
rhythm grading
tempo grading
mistake counters
scores
lives
achievements
accounts
saving progress
song selection
AI
music-theory analysis
phrase detection
automatic difficulty estimation

These are all distractions from the experiment.

PRIMARY QUESTION THE PROTOTYPE MUST ANSWER

Is this interaction enjoyable and educational?

Specifically:

Does this sequence:

very little responsibility
->
slightly longer fragments
->
longer fragments
->
complete melody

cause a beginner to learn the physical note sequence of a recognizable song almost incidentally?

SUCCESS CRITERION

The prototype succeeds if a player who initially does not know Ode to Joy can:

1. Begin at Level 1 with no visual assistance.

2. Hunt around until each required note is discovered.

3. Gradually recognize and anticipate those notes.

4. Move through progressively longer player-controlled sequences.

5. Eventually reach the final level and play the melody from memory significantly better than when they started.

Whether the player performs the rhythm correctly is deliberately outside the scope of this experiment.

FUTURE EXPERIMENT, ONLY AFTER THIS WORKS

The next dimension would be rhythm.

The first prototype teaches:

WHICH NOTES?

A later version can teach:

WHEN?

Only after the player can supply all notes should the system experiment with reducing or eliminating the indefinite wait.

That should be treated as a separate game mechanic rather than mixed into version 0.
