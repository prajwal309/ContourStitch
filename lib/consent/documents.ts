import type { Agreement } from './agreements';

type Document = readonly { title: string; text: string }[];

// TODO legal/operations: confirm applicable jurisdictions, biometric-data treatment, privacy contact,
// hosting/database subprocessors and regions, log/backup retention, and any liability cap with counsel.
// TODO product: validate the ANSUR II priors against diverse civilian and tailoring ground truth;
// confirm an age policy before using adult population priors for a public audience.
// TODO product/legal: decide whether the explicit, revocable per-revision Family Fit share needs a
// separate versioned consent event before enabling any broader third-party measurement sharing.

const privacyV1: Document = [
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
];

const privacyV3: Document = [
  {
    title: 'Camera and on-device processing',
    text: 'When you use a scanner, your browser processes live camera frames to locate pose landmarks, segment a person outline, check image quality, and estimate measurements. The optional reference step may hold one temporary frame in browser memory. This build does not upload camera frames, reference images, landmarks, or segmentation masks to ContourStitch servers. Camera tracks and temporary frame data are released when the scan ends or is interrupted.',
  },
  {
    title: 'Information we process',
    text: 'You may provide height, a reference-object length, tape measurements, corrections, and fit preferences. A scan can produce shoulder, arm, torso, circumference, and leg estimates, along with methods, confidence labels, warnings, and missing-measurement details. If you create an account, we also process the account details supplied by your sign-in method, session data, consent decisions and document versions, saved profile revisions, fit selections, and any Family Fit sharing you choose.',
  },
  {
    title: 'How measurements are used',
    text: 'Measurements are used to show and edit your fit profile and to support the fit features you request. In this build, entered height sets an approximate pixel scale; it is not used by itself to predict body shape or measurements. Camera-derived estimates appear only when the measurement engine has supporting evidence. The service is not designed for medical decisions, identity recognition, or identity verification.',
  },
  {
    title: 'Local and account storage',
    text: 'A scan that you do not save remains temporary browser data. If you explicitly save a profile on a device, the browser stores derived measurements and the selected display unit until you delete that profile or clear the browser storage. If you choose to save to your signed-in account, the application stores derived estimates, corrections, quality information, and revision history in its PostgreSQL database. The database does not receive the camera frames or person masks.',
  },
  {
    title: 'Potentially sensitive information',
    text: 'Body measurements and scan-derived geometry can be sensitive personal information and may be treated as biometric or specially protected data under some laws. This build uses them for fit-related features and does not use them to identify or authenticate you. The legal classification and any additional requirements depend on where the service is offered.',
  },
  {
    title: 'Sharing and service providers',
    text: 'We do not sell measurement profiles or send them to advertising or analytics systems in this build. Family Fit sharing is a separate, optional action: you select a saved revision and a group organizer; that organizer can see that revision until you revoke access. A recipient may already have copied information before revocation. Sign-in providers process sign-in information under their own policies. The application host and database provider process requests and account records needed to run saved-profile features; their exact names, locations, and retention settings depend on deployment and are not listed in this draft.',
  },
  {
    title: 'Optional improvement use',
    text: 'Measurement improvement is a separate, unchecked-by-default choice and is not required for measurement features. In this build, the service records your choice but has no connected export, research, or training pipeline that uses saved measurements for improvement. No camera media is authorized by this choice. Any future use must be described before it begins, including what data is used, how it is minimized or de-identified if those steps are implemented, and how long it is retained.',
  },
  {
    title: 'Retention and deletion',
    text: 'Temporary scan data is released when processing ends. A local profile remains in that browser until you delete it or clear its site data. Account profiles and their revisions remain until you delete them or delete your account. Deleting your account also deletes its consent records through the current database relationship; revocation and renewal events remain in account history until then. Account deletion does not automatically clear local copies in other browsers. Hosting logs and backups may have separate retention schedules that are not configured in this codebase.',
  },
  {
    title: 'Your privacy choices and rights',
    text: 'You can review consent status, withdraw camera or improvement consent, delete saved account measurements, and delete your account in the available account controls. You can also remove local profiles in the browser where they were saved. Depending on applicable law, you may have additional rights such as access, correction, portability, restriction, objection, or a right to complain. This build does not provide a complete privacy-request workflow or published privacy contact; those must be established before production launch.',
  },
  {
    title: 'Security',
    text: 'The application checks account ownership before allowing profile changes and sharing, and stores password credentials as hashes rather than readable passwords. No system can promise perfect security. Database encryption, hosting access controls, incident procedures, and log retention depend on the deployment and require operational verification.',
  },
];

const privacyV4: Document = privacyV3.map((section) => {
  if (section.title === 'Information we process')
    return {
      ...section,
      text: 'You may provide height, a reference-object length, tape measurements, corrections, and fit preferences. During a scan, the browser may calculate height-conditioned population priors and camera-derived estimates, along with methods, reference ranges, capture-quality information, warnings, and missing-measurement details. Prior-only values are shown separately from camera observations and are not included in the current saved scan report. If you create an account, we also process the account details supplied by your sign-in method, session data, consent decisions and document versions, saved profile revisions, fit selections, and any Family Fit sharing you choose.',
    };
  if (section.title === 'How measurements are used')
    return {
      ...section,
      text: 'Measurements are used to show and edit your fit profile and to support the fit features you request. Entered height sets approximate camera scale and, within the available reference-height range, also generates local statistical starting estimates using equal-weighted male and female regressions from the public ANSUR II U.S. military sample. That sample is not representative of a civilian population. Prior values are not observations of your body; camera estimates are separate and only appear when the measurement engine has supporting evidence. The current report/save path does not persist prior-only live-panel values. The service is not designed for medical decisions, identity recognition, or identity verification.',
    };
  if (section.title === 'Local and account storage')
    return {
      ...section,
      text: 'A scan that you do not save remains temporary browser data. Height-conditioned priors are calculated in browser memory and are not uploaded. The current live-panel prior-only values are not included in the saved scan report. If you explicitly save a profile on a device, the browser stores derived measurements and the selected display unit until you delete that profile or clear the browser storage. If you choose to save to your signed-in account, the application stores derived estimates, corrections, quality information, and revision history in its PostgreSQL database. The database does not receive camera frames or person masks.',
    };
  return section;
});

const cameraV3: Document = [
  {
    title: 'Purpose and scope',
    text: 'By checking this separate consent and continuing, you allow the browser-based scanner to process camera frames for estimating body dimensions for clothing fit. The browser may analyze pose landmarks, a person-segmentation mask, silhouette widths, image quality, and view alignment. An optional reference step may process a known-size object in the same frame.',
  },
  {
    title: 'Height, population priors, and progressive estimates',
    text: 'You provide your height as an approximate scale anchor. Within 150–190 cm, the browser also calculates height-conditioned starting estimates from equal-weighted male and female regressions fitted to the public ANSUR II U.S. military cohorts. This dataset is not representative of civilian customers, and these prior values are not measurements of your body. The scanner separately refines values when its camera method has sufficient valid frames and views. The current camera method does not estimate inseam; its live value remains a population prior unless you enter a tape measurement.',
  },
  {
    title: 'Processing and storage',
    text: 'Camera frames, the optional reference frame, landmarks, and masks are processed temporarily in your browser and are not uploaded to ContourStitch servers in this build. Height-conditioned priors are also calculated locally. Leaving or stopping the scan releases camera tracks and temporary frame data. If you explicitly save a profile, only supported derived measurements, corrections, available quality information, and related profile history are stored locally or in your signed-in account; prior-only live-panel values are not included in the current saved scan report, and raw camera media is not part of the saved profile.',
  },
  {
    title: 'Voluntary choice and withdrawal',
    text: 'Participation is voluntary. You can decline and enter measurements with a tape, deny browser camera permission, or stop a scan. For a signed-in account, you can withdraw camera consent in My Account; this prevents future scans that require this consent but does not undo prior processing. Guest consent is not persisted as an account event and applies only to the current flow. Browser permission is controlled separately in your browser settings.',
  },
  {
    title: 'Experimental estimates and your responsibility',
    text: 'The scanner and population priors are experimental, not a validated 3D body scan. The source population, clothing, posture, movement, lighting, framing, camera perspective, segmentation, landmarks, and scale errors can change or prevent estimates. Check all values yourself with a tape and applicable garment instructions before production, purchase, or alteration. The scan does not include garment ease or pattern construction.',
  },
  {
    title: 'No warranty or third-party reliance',
    text: 'No measurement or fit result is guaranteed. Do not treat the results as certified or rely on them for medical, identity, safety, employment, or other decisions. Do not ask a tailor, retailer, or another person to rely on an estimate as accurate without independent verification. The warranty and liability limits in the Terms of Service apply only to the extent allowed by applicable law.',
  },
  {
    title: 'Permission to measure others',
    text: 'Only use the camera to measure yourself or another person who has been told what the scan does and has freely agreed, or where you have lawful authority to provide that permission. Do not secretly measure, record, or process another person.',
  },
  {
    title: 'Material changes',
    text: 'We will update this document when the purpose, data types, recipients, or processing materially changes. The service will request renewed consent when required before using a materially changed camera feature. See the Privacy Policy for storage, deletion, sharing, and rights information.',
  },
];

const accuracyV3: Document = [
  {
    title: 'Population priors are not personal measurements',
    text: 'Before usable camera evidence arrives, the live panel may show estimates conditioned on entered height using published ANSUR II measurements. The source cohorts are U.S. military personnel, not a representative civilian or tailoring population. The cohorts are equally weighted because the app does not request sex. These values and their broad reference ranges describe variation in that dataset; they are not personal confidence intervals or claims about your body.',
  },
  {
    title: 'Camera estimates and progressive updates',
    text: 'Camera-derived estimates are separate from the population priors and are blended into the live display as supported landmarks, silhouettes, views, and scale evidence become available. Repeatability and capture quality can change the displayed working range, but those ranges have not been calibrated against representative ground-truth tailoring measurements. Some measurements, including inseam in this build, may remain prior-only or require tape entry.',
  },
  {
    title: 'Sources of error',
    text: 'Results can be affected by the entered height or reference length, the source population, clothing, footwear, posture, body movement, camera height and angle, distance, lens perspective, lighting, blur, cropping, segmentation, landmark confidence, view alignment, and differences between measurement conventions. Some measurements may be unavailable or especially uncertain when evidence is missing or views disagree.',
  },
  {
    title: 'Independent verification and fit',
    text: 'Measure each body dimension with a flexible tape using the garment maker’s stated convention before cutting fabric, ordering a garment, or making an alteration. Body measurements do not include ease, fabric behavior, pattern drafting, or construction tolerances. ContourStitch does not guarantee fit, comfort, workmanship, or a particular result.',
  },
  {
    title: 'No medical or identity use',
    text: 'Do not use estimates for diagnosis, treatment, health screening, safety decisions, identity verification, access control, employment, insurance, or legal decisions. Do not present an estimate as a certified measurement to a third party. The Terms of Service and Body Measurement Consent provide additional limitations.',
  },
  {
    title: 'Legal limits',
    text: 'To the extent permitted by law, estimates are provided without a warranty of accuracy or fitness for a particular purpose. Nothing in this disclaimer removes a consumer right or remedy that applicable law makes non-waivable.',
  },
];

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
    '2': [
      {
        title: 'Experimental service',
        text: 'ContourStitch is an experimental clothing-fit service. Its camera-based estimates and fit suggestions can change, be unavailable, or contain errors. Height is used as an approximate scale input; the service does not promise that an estimate is a tape measurement, a validated body scan, or a production-ready garment specification.',
      },
      {
        title: 'Acceptable use and permission',
        text: 'Use the service lawfully and only for yourself or for another person who has given informed permission, or for whom you have authority to act. Do not secretly capture, scan, or measure anyone; do not use the service to harass, discriminate, identify, or make medical decisions about a person. Keep people who have not agreed out of camera view. Do not interfere with the service, bypass access controls, or use it to violate another person’s rights.',
      },
      {
        title: 'Your information and limited service permission',
        text: 'You keep your rights in measurements and other information you provide. You allow ContourStitch to process that information only as needed to provide the features you choose, keep your account and saved profiles working, and protect the service. This permission does not include camera media or measurement use for improvement; those are not uploaded for this purpose, and any future improvement program requires its own separate, optional choice.',
      },
      {
        title: 'Intellectual property',
        text: 'ContourStitch names, original interface, text, and software are protected by applicable intellectual-property laws. Third-party assets remain subject to their own licenses and notices. You may use the service as offered, but may not copy, redistribute, or commercially exploit protected materials, except where applicable law does not allow that restriction.',
      },
      {
        title: 'Family Fit and third-party services',
        text: 'Family Fit sharing is optional and separate from camera and improvement consent. You choose a saved revision and recipient, and can revoke future access; revocation cannot retrieve copies already made by a recipient. Sign-in providers and hosting or database providers operate under their own terms and privacy practices. If a future feature links to a merchant or other external service, its products, transactions, sizing, and privacy practices are controlled by that third party.',
      },
      {
        title: 'No professional or third-party reliance',
        text: 'The service is for personal clothing-fit exploration, not medical, safety, identity-verification, employment, insurance, or legal decisions. Do not provide estimates as certified measurements or ask a tailor, seller, or other person to rely on them without independent verification. Garment ease and construction requirements are separate from body measurements.',
      },
      {
        title: 'Disclaimer of warranties',
        text: 'To the extent permitted by law, the service is provided on an “as available” and “as is” basis, without promises that it will be uninterrupted, error-free, accurate, suitable for a particular garment, or compatible with every device. This section does not limit any warranty or consumer right that applicable law does not allow us to exclude.',
      },
      {
        title: 'Limitation of liability',
        text: 'To the extent permitted by law, ContourStitch is not responsible for indirect, incidental, special, consequential, exemplary, or punitive loss arising from use of the experimental service, including a garment made from an unverified estimate. Nothing in these terms excludes liability or remedies that cannot lawfully be excluded or limited. Any further liability cap requires jurisdiction-specific legal review before publication.',
      },
      {
        title: 'Indemnity where permitted',
        text: 'Where applicable law permits, you are responsible for claims caused by your unlawful use of the service or your violation of another person’s rights. This does not require you to indemnify ContourStitch for losses caused by ContourStitch’s own conduct, and does not apply where such a term would be unlawful.',
      },
      {
        title: 'Service changes and account closure',
        text: 'We may update, suspend, or discontinue features for maintenance, security, legal compliance, or product changes. We may restrict access when reasonably needed to address abuse, security risks, or legal requirements. You may stop using the service and delete your account through the available controls. If a material change requires renewed consent, the service will ask you to review the current document before the affected feature is used.',
      },
      {
        title: 'Related documents and unresolved terms',
        text: 'The Privacy Policy describes information handling, and the Body Measurement Consent and Measurement Accuracy Disclaimer explain camera processing and measurement limitations. This draft does not select a governing jurisdiction, company address, formal notice process, or privacy contact. Those terms require review by qualified counsel for the places where the service will operate.',
      },
    ],
  },
  PRIVACY: {
    '1': privacyV1,
    '2': [
      privacyV1[0],
      {
        title: 'Account information and saved measurements',
        text: 'If you create an account with a username and password, we store your username and a salted password hash. This sign-in option requires no email address. If you use a connected provider, it supplies a provider ID and may supply your name, email, and profile image address. The provider handles its own sign-in data under its policies. ContourStitch stores account identifiers, session records, and agreement versions and decisions. When you save to your account, PostgreSQL stores your derived measurements, corrections, available quality information, and revision history. The application host and database host handle requests and stored records needed to deliver these features.',
      },
      {
        title: 'Sign-in protection',
        text: 'We limit repeated password attempts using temporary counters keyed by a hashed username or network address. A counter expires after ten minutes. Expired counters are removed periodically as new sign-in requests arrive.',
      },
      ...privacyV1.slice(2),
    ],
    '3': privacyV3,
    '4': privacyV4,
    '5': [
      ...privacyV4,
      {
        title: 'Password screening and recovery',
        text: 'When you create or reset a password, the server checks publicly documented breach data using Have I Been Pwned. The request sends only the first five characters of a SHA-1 password hash, without your username, full hash, or password. We store passwords as salted scrypt hashes. If you create a one-time recovery code, we store its hash and remove it when you use or replace the code. A password reset ends existing ContourStitch sessions.',
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
    '2': [
      {
        title: 'Purpose and scope',
        text: 'By checking this separate consent and continuing, you allow the browser-based scanner to process camera frames for estimating body dimensions for clothing fit. The browser may analyze pose landmarks, a person-segmentation mask, silhouette widths, image quality, and view alignment. An optional reference step may process a known-size object in the same frame.',
      },
      {
        title: 'Height, priors, and progressive estimates',
        text: 'You provide your height as an approximate scale anchor; an optional known-size reference may also help set scale. The current build does not use height alone to generate statistical anthropometric body-measurement priors. It presents camera-derived estimates as supported frame and view evidence becomes available and may refine them as more observations arrive. Any future population-based prior must be clearly labeled as a statistical estimate, kept distinct from direct camera observations, and described in an updated notice before use.',
      },
      {
        title: 'Processing and storage',
        text: 'Camera frames, the optional reference frame, landmarks, and masks are processed temporarily in your browser and are not uploaded to ContourStitch servers in this build. Leaving or stopping the scan releases camera tracks and temporary frame data. If you explicitly save a profile, only derived measurements, corrections, available quality information, and related profile history are stored locally or in your signed-in account; raw camera media is not part of the saved profile.',
      },
      {
        title: 'Voluntary choice and withdrawal',
        text: 'Participation is voluntary. You can decline and enter measurements with a tape, deny browser camera permission, or stop a scan. For a signed-in account, you can withdraw camera consent in My Account; this prevents future scans that require this consent but does not undo prior processing. Guest consent is not persisted as an account event and applies only to the current flow. Browser permission is controlled separately in your browser settings.',
      },
      {
        title: 'Experimental estimates and your responsibility',
        text: 'The scanner is experimental, not a validated 3D body scan. Clothing, posture, movement, lighting, framing, camera perspective, segmentation, landmarks, and scale errors can change or prevent estimates. Check all values yourself with a tape and applicable garment instructions before production, purchase, or alteration. The scan does not include garment ease or pattern construction.',
      },
      {
        title: 'No warranty or third-party reliance',
        text: 'No measurement or fit result is guaranteed. Do not treat the results as certified or rely on them for medical, identity, safety, employment, or other decisions. Do not ask a tailor, retailer, or another person to rely on an estimate as accurate without independent verification. The warranty and liability limits in the Terms of Service apply only to the extent allowed by applicable law.',
      },
      {
        title: 'Permission to measure others',
        text: 'Only use the camera to measure yourself or another person who has been told what the scan does and has freely agreed, or where you have lawful authority to provide that permission. Do not secretly measure, record, or process another person.',
      },
      {
        title: 'Material changes',
        text: 'We will update this document when the purpose, data types, recipients, or processing materially changes. The service will request renewed consent when required before using a materially changed camera feature. See the Privacy Policy for storage, deletion, sharing, and rights information.',
      },
    ],
    '3': cameraV3,
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
    '2': [
      {
        title: 'Statistical and camera estimates',
        text: 'ContourStitch measurements are experimental estimates, not direct tape readings or a validated reconstruction of your body. In the current build, entered height is used to set approximate pixel scale; it is not used alone to infer body proportions. Camera estimates are produced only when the selected measurement method has supporting landmarks, silhouettes, and views. Confidence describes capture evidence and is not a validated physical error interval.',
      },
      {
        title: 'Sources of error',
        text: 'Results can be affected by the entered height or reference length, clothing, footwear, posture, body movement, camera height and angle, distance, lens perspective, lighting, blur, cropping, segmentation, landmark confidence, view alignment, and differences between measurement conventions. Some measurements may be unavailable or especially uncertain when evidence is missing or views disagree.',
      },
      {
        title: 'Independent verification and fit',
        text: 'Measure each body dimension with a flexible tape using the garment maker’s stated convention before cutting fabric, ordering a garment, or making an alteration. Body measurements do not include ease, fabric behavior, pattern drafting, or construction tolerances. ContourStitch does not guarantee fit, comfort, workmanship, or a particular result.',
      },
      {
        title: 'No medical or identity use',
        text: 'Do not use estimates for diagnosis, treatment, health screening, safety decisions, identity verification, access control, employment, insurance, or legal decisions. Do not present an estimate as a certified measurement to a third party. The Terms of Service and Body Measurement Consent provide additional limitations.',
      },
      {
        title: 'Legal limits',
        text: 'To the extent permitted by law, estimates are provided without a warranty of accuracy or fitness for a particular purpose. Nothing in this disclaimer removes a consumer right or remedy that applicable law makes non-waivable.',
      },
    ],
    '3': accuracyV3,
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
    '2': [
      {
        title: 'Separate and optional choice',
        text: 'This opt-in is separate from camera processing, account terms, and any individual Family Fit share. It is unchecked by default. You can decline it and continue using core measurement and fit features without a penalty.',
      },
      {
        title: 'Limited purpose and current implementation',
        text: 'If an improvement or research feature is activated, this consent would permit use of saved derived measurements only to evaluate and improve body-measurement estimates and related fit methods, not for advertising, identity recognition, or unrelated purposes. In the current build, the app records your preference but has no connected export, research, or training pipeline that uses saved measurements. No measurement data is currently sent to an improvement dataset through this consent.',
      },
      {
        title: 'Data minimization and de-identification',
        text: 'Raw camera frames, landmarks, and segmentation masks are not included in this consent. No de-identification pipeline is currently implemented for improvement use, so this document does not promise that data has been de-identified. Before any future use begins, we must describe the actual fields collected, safeguards, recipients, retention period, and any de-identification process that is actually in place.',
      },
      {
        title: 'Withdrawal and retention',
        text: 'You can withdraw this choice at any time in My Account under Privacy & Consent. Withdrawal prevents future improvement use under this consent. It cannot reverse processing already completed or recall aggregate outputs that cannot reasonably be linked back to you, if any exist. The current build has no improvement-data export or training pipeline. Account and consent-record deletion is described in the Privacy Policy.',
      },
    ],
  },
};

// Historical revision dates were not recorded. Do not infer or backdate them.
export const documentLastUpdated: Record<
  Agreement,
  Record<string, string | null>
> = {
  TERMS: { '1': null, '2': '2026-11-24' },
  PRIVACY: {
    '1': null,
    '2': null,
    '3': '2026-11-24',
    '4': '2026-11-24',
    '5': '2026-11-25',
  },
  CAMERA: { '1': null, '2': '2026-11-24', '3': '2026-11-24' },
  ACCURACY: { '1': null, '2': '2026-11-24', '3': '2026-11-24' },
  IMPROVEMENT: { '1': null, '2': '2026-11-24' },
};
