export const RESOURCE_LIBRARY = {
  gettingStarted: [
    { label: 'Hoffman Academy — free piano lessons', url: 'https://www.hoffmanacademy.com/' },
    { label: 'musictheory.net — reading music basics', url: 'https://www.musictheory.net/lessons' }
  ],
  theory: [
    { label: 'musictheory.net lessons', url: 'https://www.musictheory.net/lessons' },
    { label: 'teoria — music theory and ear training', url: 'https://www.teoria.com/en/' }
  ],
  technique: [
    { label: 'Hoffman Academy — technique lessons', url: 'https://www.hoffmanacademy.com/' }
  ],
  repertoire: [
    { label: 'IMSLP — free sheet music library', url: 'https://imslp.org/' }
  ],
  earTraining: [
    { label: 'teoria — ear training exercises', url: 'https://www.teoria.com/en/exercises/' },
    { label: 'musictheory.net — ear training', url: 'https://www.musictheory.net/exercises' }
  ],
  improvisation: [
    { label: 'Hoffman Academy — improvisation lessons', url: 'https://www.hoffmanacademy.com/' }
  ],
  performance: [
    { label: 'musictheory.net lessons', url: 'https://www.musictheory.net/lessons' }
  ]
};

export const TOPIC_RESOURCES = {
  'The Staff and Clefs (Treble and Bass)': [
    { label: 'musictheory.net — staff, clefs, and notes', url: 'https://www.musictheory.net/lessons/10' }
  ],
  'Circle of Fifths': [
    { label: 'musictheory.net — the circle of fifths', url: 'https://www.musictheory.net/lessons/34' }
  ],
  'Triads (Major and Minor)': [
    { label: 'musictheory.net — triads', url: 'https://www.musictheory.net/lessons/40' }
  ],
  'Interval Recognition by Ear': [
    { label: 'teoria — interval ear training', url: 'https://www.teoria.com/en/exercises/' }
  ]
};

export const PHASES = [
  {
    title: 'Getting Started',
    priority: 'P0',
    resourceKey: 'gettingStarted',
    sections: [
      {
        title: 'Setup and Posture',
        items: [
          'Choosing a Keyboard or Piano', 'Bench Height and Posture', 'Hand Position and Finger Numbering',
          ['Instrument Maintenance Basics', 'P3']
        ]
      },
      {
        title: 'Reading Music',
        items: [
          'The Staff and Clefs (Treble and Bass)', 'Note Names on the Keyboard', 'Note Durations and Rests',
          'Time Signatures', ['Key Signatures', 'P1'], 'Middle C and Landmark Notes'
        ]
      }
    ]
  },
  {
    title: 'Foundational Technique',
    priority: 'P0',
    resourceKey: 'technique',
    sections: [
      {
        title: 'Hand Technique',
        items: [
          'Finger Independence Exercises', 'Hand Position and Relaxation', ['Wrist Motion', 'P1'],
          'Five-Finger Position Patterns', ['Thumb Crossing (Scale Fingering)', 'P1']
        ]
      },
      {
        title: 'Rhythm Basics',
        items: [
          'Counting Rhythms Aloud', 'Steady Beat and Metronome Practice', 'Simple Time vs Compound Time',
          ['Syncopation Basics', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Music Theory Fundamentals',
    priority: 'P0',
    resourceKey: 'theory',
    sections: [
      {
        title: 'Scales and Key Signatures',
        items: [
          'Major Scales', 'Natural Minor Scales', ['Harmonic and Melodic Minor Scales', 'P1'],
          'Circle of Fifths', ['Chromatic Scale', 'P2']
        ]
      },
      {
        title: 'Chords and Harmony',
        items: [
          'Triads (Major and Minor)', ['Diminished and Augmented Triads', 'P2'], 'Chord Inversions',
          'Seventh Chords', ['Roman Numeral Analysis', 'P1'], 'I-IV-V Chord Progressions'
        ]
      }
    ]
  },
  {
    title: 'Playing Technique',
    priority: 'P1',
    resourceKey: 'technique',
    sections: [
      {
        title: 'Building Technique',
        items: [
          'Scale Playing with Correct Fingering', 'Arpeggios', ['Hanon Exercises', 'P2'],
          'Dynamics (piano to forte)', 'Articulation (Legato and Staccato)',
          ['Pedaling Technique (Sustain Pedal)', 'P1'], ['Voicing and Balance Between Hands', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Repertoire',
    priority: 'P1',
    resourceKey: 'repertoire',
    sections: [
      {
        title: 'Beginner Repertoire',
        items: [
          'Simple Folk Songs and Method Book Pieces', 'Beginner Classical Pieces',
          ['Beginner Pop and Contemporary Arrangements', 'P2']
        ]
      },
      {
        title: 'Intermediate Repertoire',
        items: [
          ['Baroque Pieces (e.g. Bach Minuets)', 'P1'], ['Classical Sonatinas', 'P1'],
          ['Romantic-era Character Pieces', 'P2'], ['Playing by Ear', 'P2']
        ]
      }
    ]
  },
  {
    title: 'Sight-Reading and Ear Training',
    priority: 'P1',
    resourceKey: 'earTraining',
    sections: [
      {
        title: 'Sight-Reading',
        items: [
          'Sight-Reading Simple Pieces Daily', 'Interval Recognition on the Page',
          ['Sight-Reading Hands Together', 'P1']
        ]
      },
      {
        title: 'Ear Training',
        items: [
          'Interval Recognition by Ear', ['Chord Quality Recognition by Ear', 'P2'],
          ['Transcribing Simple Melodies', 'P2'], 'Playing Melodies by Ear'
        ]
      }
    ]
  },
  {
    title: 'Improvisation and Composition',
    priority: 'P2',
    resourceKey: 'improvisation',
    sections: [
      {
        title: 'Improvisation',
        items: [
          ['Improvising over I-IV-V Progressions', 'P2'], ['Blues Scale Improvisation', 'P2'],
          ['Left-Hand Accompaniment Patterns', 'P2']
        ]
      },
      {
        title: 'Composition Basics',
        items: [['Writing Simple Melodies', 'P3'], ['Basic Song Form (AABA / Verse-Chorus)', 'P3']]
      }
    ]
  },
  {
    title: 'Performance and Growth',
    priority: 'P0',
    resourceKey: 'performance',
    sections: [
      {
        title: 'Performance Skills',
        items: [
          'Practicing with a Metronome', 'Memorization Techniques', 'Performance Anxiety Management',
          'Recording Yourself to Self-Assess', ['Performing for an Audience', 'P1']
        ]
      },
      {
        title: 'Ongoing Growth',
        items: [
          'Setting Practice Goals', ['Piano Exams and Certifications Awareness (ABRSM, RCM)', 'P2'],
          ['Finding a Teacher or Community', 'P2'], 'Building a Practice Routine'
        ]
      }
    ]
  }
];

export function buildSeedItems() {
  const items = {};
  PHASES.forEach((phase, phaseIndex) => {
    phase.sections.forEach((section, sectionIndex) => {
      section.items.forEach((entry, itemIndex) => {
        const [title, priorityOverride] = Array.isArray(entry) ? entry : [entry, phase.priority];
        const id = `seed-${phaseIndex}-${sectionIndex}-${itemIndex}`;
        const phaseResources = RESOURCE_LIBRARY[phase.resourceKey] || [];
        const topicResources = TOPIC_RESOURCES[title] || [];
        const mergedResources = [...topicResources];
        phaseResources.forEach(r => {
          if (!mergedResources.some(m => m.url === r.url)) mergedResources.push(r);
        });
        items[id] = {
          id,
          title,
          phase: phase.title,
          section: section.title,
          priority: priorityOverride || phase.priority,
          done: false,
          custom: false,
          deleted: false,
          resources: mergedResources
        };
      });
    });
  });
  return items;
}
