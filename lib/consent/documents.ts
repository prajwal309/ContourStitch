import type { Agreement } from './agreements';

type Document = readonly { title: string; text: string }[];

// Preserve each published version here. Add a new entry before changing an active version.
export const documents: Record<Agreement, Record<string, Document>> = {
  TERMS: {
    '1': [
      {
        title: 'What ContourStitch provides',
        text: 'ContourStitch offers camera-based body measurement estimates, manual tape entry, and saved fit profiles. The beta features may change. Use a tape to confirm measurements before cutting fabric, ordering garments, or making alterations.',
      },
      {
        title: 'Your account and your choices',
        text: 'You can measure as a guest or use a supported sign-in provider to save fit profiles to an account. Use your own sign-in and share measurements only with the people you choose. If another person is being measured, make sure they understand the process and agree before opening the camera.',
      },
      {
        title: 'Using the service responsibly',
        text: 'Use ContourStitch for clothing and fit. Respect other people’s privacy and keep anyone who has not agreed to be measured out of frame. Account features may ask you to review updated terms before you continue.',
      },
      {
        title: 'Account and data controls',
        text: 'My Account provides controls to delete account measurements or the account itself. The Privacy Policy explains local copies, family sharing, and what the service stores.',
      },
    ],
  },
  PRIVACY: {
    '1': [
      {
        title: 'Camera and browser data',
        text: 'The guided and experimental scanners use your browser to process frames, pose landmarks, silhouettes, and any reference frame. ContourStitch does not send the frames, landmarks, or silhouettes to its server. Unsaved scans are held in browser memory. If you save on this device, the browser stores a derived fit profile and its display unit.',
      },
      {
        title: 'Account information and saved measurements',
        text: 'Google or Facebook supplies a provider ID and may supply your name, email, and profile image address. ContourStitch stores account and provider identifiers, session records, and agreement versions and decisions. When you save to your account, PostgreSQL stores your derived measurements, corrections, available quality information, and revision history. The application host and database host handle requests and stored records needed to deliver these features. Your sign-in provider handles its own sign-in data under its policies.',
      },
      {
        title: 'Family Fit Studio',
        text: 'A family group shows membership and display names to its members. An organizer can see the specific measurement revision you share with them. You can revoke that share within the group. Removing access in the app cannot retrieve a copy someone already made.',
      },
      {
        title: 'Optional improvement consent',
        text: 'You can separately allow use of measurements you save to your account for improving measurement quality. The current app records this preference and has no improvement-data export or training pipeline connected to saved profiles. Your choice does not affect use of the app and does not authorize camera media collection or family sharing.',
      },
      {
        title: 'Deleting data',
        text: 'In My Account, you can delete saved measurements and their history, clear measurement copies in the current browser, or delete your account and its associated consent records. Account deletion alone leaves browser-only copies available for you to remove separately. Copies in other browsers must be removed there. Family groups with other members can continue under a different organizer. Hosting logs and backups may follow separate retention schedules.',
      },
    ],
  },
  CAMERA: {
    '1': [
      {
        title: 'What you allow',
        text: 'You allow ContourStitch to analyze camera frames in your browser to estimate body dimensions for clothing fit. The scanners use pose landmarks, silhouettes, your height, and an optional reference object to estimate size and shape. Allow camera access in your browser only when you are ready.',
      },
      {
        title: 'What is saved',
        text: 'Frames, landmarks, and silhouettes remain in browser memory during processing. If you choose to save a fit profile, the saved profile contains derived measurements. Optional improvement use and family sharing are separate choices.',
      },
      {
        title: 'How to stop',
        text: 'Leave the scan or block camera access in your browser to stop capture. You can withdraw consent for future scans in My Account. Guest camera consent applies to the current measurement flow. Use tape entry to measure without a camera.',
      },
    ],
  },
  ACCURACY: {
    '1': [
      {
        title: 'Understand the estimates',
        text: 'Camera measurements are experimental estimates and may contain errors. Clothing, posture, lighting, framing, motion, perspective, and scale calibration can affect the result. A measurement may be withheld when the app lacks sufficient evidence.',
      },
      {
        title: 'Confirm fit before committing',
        text: 'Quality indicators describe the scan evidence and have no validated physical error interval. Check every measurement with a tape before cutting fabric, placing a garment order, or making alterations. Body dimensions do not include garment ease. You can correct estimates or enter tape measurements directly.',
      },
    ],
  },
  IMPROVEMENT: {
    '1': [
      {
        title: 'Choose whether to participate',
        text: 'This optional consent covers derived measurements saved to your ContourStitch account for evaluating and improving measurement estimates. It excludes camera frames, video, landmarks, and silhouettes. The current app records your preference without exporting measurements or using them for training.',
      },
      {
        title: 'Change your choice',
        text: 'You can use ContourStitch with this setting off. Withdraw it at any time in My Account under Privacy & Consent. Withdrawal ends permission for future improvement use under this agreement.',
      },
    ],
  },
};
