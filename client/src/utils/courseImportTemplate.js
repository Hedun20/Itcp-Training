export const COURSE_IMPORT_SCHEMA_VERSION = '1.0';
export const MAX_COURSE_IMPORT_BYTES = 5 * 1024 * 1024;

export const COURSE_IMPORT_TEMPLATE = Object.freeze({
  schemaVersion: COURSE_IMPORT_SCHEMA_VERSION,
  course: {
    code: 'DCT-SAFETY-01',
    slug: 'data-center-safety-fundamentals',
    title: 'Data Center Safety Fundamentals',
    shortDescription: 'Essential safety practices for technicians working in data-center environments.',
    description: 'This course introduces access control, electrical safety, emergency procedures, and safe working habits for data-center technicians.',
    coverImage: '',
    estimatedDuration: '60 minutes',
    passMark: 80,
    category: 'Safety',
    tags: ['data-center', 'safety', 'onboarding'],
    modules: [
      {
        title: 'Access and personal responsibility',
        description: 'Understand authorization, restricted areas, and individual safety responsibilities.',
        blocks: [
          { type: 'heading', text: 'Entering restricted technical areas', level: 2 },
          { type: 'paragraph', text: 'Only authorized personnel may enter restricted technical areas. Always use your own access credential and follow the site access procedure.' },
          { type: 'callout', title: 'Never share credentials', text: 'Access badges and login credentials are personal and must never be shared.', tone: 'warning' },
          { type: 'checklist', items: ['Confirm your authorization', 'Wear required protective equipment', 'Report unsafe conditions immediately'] },
        ],
      },
      {
        title: 'Emergency response',
        description: 'Follow the correct response during alarms, incidents, and evacuations.',
        blocks: [
          { type: 'heading', text: 'When an alarm is activated', level: 2 },
          { type: 'paragraph', text: 'Stop work safely, follow the designated evacuation route, and report to the assembly point.' },
          { type: 'callout', title: 'Do not re-enter', text: 'Do not re-enter the building until authorized personnel confirm that it is safe.', tone: 'warning' },
        ],
      },
    ],
    assessment: {
      questions: [
        {
          questionText: 'What should you verify before entering a restricted technical area?',
          options: ['Your authorization', 'The room temperature', 'The number of available racks', 'The cafeteria schedule'],
          correctAnswer: 0,
          explanation: 'Authorization must be verified before entering a restricted area.',
          points: 1,
        },
        {
          questionText: 'What should you do after evacuating the building?',
          options: ['Return for personal belongings', 'Report to the assembly point', 'Wait beside the entrance', 'Continue working remotely without reporting'],
          correctAnswer: 1,
          explanation: 'Everyone must report to the designated assembly point so attendance can be confirmed.',
          points: 1,
        },
      ],
    },
  },
});
