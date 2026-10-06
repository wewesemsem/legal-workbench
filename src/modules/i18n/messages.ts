import type { Locale } from "@/modules/i18n/config";

export type Messages = {
  brand: string;
  brandTagline: string;
  language: string;
  theme: string;
  themeLight: string;
  themeDark: string;
  themeSwitchToLight: string;
  themeSwitchToDark: string;
  home: string;
  matters: string;
  clients: string;
  documents: string;
  settings: string;
  menu: string;
  close: string;
  signOut: string;
  signingOut: string;
  commandPalette: string;
  landingEyebrow: string;
  landingTitle: string;
  landingBody: string;
  createAccount: string;
  signIn: string;
  openWorkspace: string;
  loginTitle: string;
  loginSubtitle: string;
  authShowcaseTitle: string;
  authShowcaseBody: string;
  authShotOverview: string;
  authShotAi: string;
  authShotResearch: string;
  authShotApproval: string;
  email: string;
  password: string;
  signingIn: string;
  noAccount: string;
  register: string;
  needConfirm: string;
  resendConfirmation: string;
  registerTitle: string;
  registerSubtitle: string;
  alreadyRegistered: string;
  firstName: string;
  lastName: string;
  role: string;
  lawyer: string;
  client: string;
  creatingAccount: string;
  verifyEyebrow: string;
  verifyTitle: string;
  verifyBodyBefore: string;
  verifyBodyInbox: string;
  verifyBodyAfter: string;
  needNewLink: string;
  needNewLinkBody: string;
  alreadyVerified: string;
  loginFailed: string;

  welcome: string;
  homeSubtitle: string;
  newMatter: string;
  needsAttention: string;
  recentMatters: string;
  viewAll: string;
  askAi: string;
  openMatter: string;
  noMattersTitle: string;
  noMattersBody: string;
  createMatter: string;
  publicLawResearch: string;
  publicLawResearchBody: string;
  documentsCardBody: string;
  settingsCardBody: string;

  mattersTitle: string;
  mattersSubtitle: string;
  updated: string;

  clientsTitle: string;
  clientsSubtitle: string;
  noClientsTitle: string;
  noClientsBody: string;
  matterCount: string;
  mattersCount: string;

  documentsTitle: string;
  documentsSubtitle: string;
  noDocumentsTitle: string;
  noDocumentsBody: string;
  openAMatter: string;
  browseMatters: string;
  pages: string;
  pagesPending: string;
  searchDocuments: string;
  upload: string;
  uploadHint: string;
  takePhotos: string;
  takePhotosHint: string;

  settingsTitle: string;
  settingsSubtitle: string;
  account: string;
  name: string;
  workspaces: string;
  workspacesBody: string;
  createWorkspace: string;
  noWorkspaces: string;

  backToMatters: string;
  yourRole: string;
  approvalRequired: string;
  approvalRequiredBody: string;
  reviewNow: string;

  overview: string;
  ai: string;
  research: string;
  drafts: string;
  activity: string;

  whereThingsStand: string;
  status: string;
  aiSummary: string;
  askAiForSummary: string;
  reviewADocument: string;
  researchAnIssue: string;
  draftADocument: string;
  uploadDocuments: string;
  recentActivity: string;
  noActivityTitle: string;
  noActivityBody: string;
  participants: string;
  updateMatter: string;

  matterContext: string;
  matterContextBody: string;
  keyFacts: string;
  preferences: string;
  suggestedUpdates: string;
  save: string;
  dontSave: string;
  contextNeedsDecision: string;
  keepExisting: string;
  useProposed: string;
  noKeyFacts: string;
  noPreferences: string;
  addToContext: string;
  label: string;
  value: string;
  edit: string;
  remove: string;
  clientLabel: string;

  matterAi: string;
  whatWouldYouLike: string;
  researchIssue: string;
  reviewDocument: string;
  draftSomething: string;
  analyzeMatter: string;
  askQuestion: string;
  askAnything: string;
  askAnythingHint: string;
  send: string;
  working: string;
  recentWork: string;
  noAiWork: string;
  summary: string;
  sources: string;
  draftPreview: string;
  openInEditor: string;
  hideContext: string;
  showContext: string;
  onlyLawyersAi: string;
  enterRequest: string;
  aiRequestFailed: string;
  examplesPrompt: string;
  loadingMatterAi: string;

  researchTitle: string;
  researchSubtitle: string;
  researchWithAi: string;
  whatResearching: string;
  researchPreferOfficial: string;
  needFullerWorkflow: string;
  needFullerWorkflowBody: string;
  startInMatterAi: string;

  draftsTitle: string;
  draftsSubtitle: string;
  newDraft: string;
  lastEdited: string;
  noDraftsTitle: string;
  noDraftsBody: string;
  createDraft: string;
  backToDrafts: string;

  activityTitle: string;
  activitySubtitle: string;
  today: string;
  yesterday: string;

  evidence: string;
  openSource: string;
  openSourceHint: string;

  issuesFound: string;
  issueFound: string;
  high: string;
  medium: string;
  informational: string;
  recommended: string;
  view: string;

  approvalTitle: string;
  approvalDraftBody: string;
  approvalMemoryTitle: string;
  approvalInferred: string;
  proposedDraft: string;
  approve: string;
  reject: string;
  review: string;
  itemsNeedReview: string;
  oneItemNeedsReview: string;

  workingOnRequest: string;
  latestProgress: string;
  viewDetails: string;
  hideDetails: string;
  researchCompleted: string;
  researchFailed: string;
  executionSteps: string;
  evidenceItemsCount: string;
  legalProvisionsCount: string;
  followUpPlaceholder: string;
  copyResponse: string;
  copied: string;
  regenerate: string;
  you: string;
  askFollowUp: string;
  newConversation: string;

  document: string;
  backToDocuments: string;
  askAboutDocument: string;
  extractedTextHint: string;
  citationsOpenPage: string;
  pageLabel: string;
  noTextExtracted: string;
  extractingText: string;
  noExtractedText: string;
  previewUnavailable: string;
  downloadOriginal: string;
  draftLabel: string;
  draftPlaceholder: string;
  sourceRun: string;
  goToHome: string;
  browseClients: string;
  browseDocumentsNav: string;
  navigate: string;
  commandSearchPlaceholder: string;
  commandWhatToDo: string;
  closeCommandPalette: string;
  askAiDash: string;
  researchDash: string;
  draftDash: string;
  question: string;
  researching: string;
  searchingOfficial: string;
  answer: string;
  viewAnalysisDetails: string;
  legalQuestionPlaceholder: string;
  primaryOfficial: string;
  webResearch: string;
  researchSource: string;
  officialLegalSources: string;
  internet: string;
  both: string;
  internetMatterOnly: string;
  noMatches: string;
  commandPaletteFooter: string;
  court: string;
  secondary: string;
  uploading: string;
  processingDocument: string;
  choosePdfOrImage: string;
  uploadFailed: string;
  documentReady: string;
  uploadedProcessingFailed: string;
  uploadPdfOrImage: string;
  uploadDocument: string;
  deleteDocumentConfirm: string;
  deleteFailed: string;
  deleting: string;
  delete: string;
  retryFailed: string;
  retrying: string;
  retry: string;
  documentTitleOptional: string;
  courtFilingPhotos: string;
  takeSelectPhotos: string;
  pagesReady: string;
  up: string;
  down: string;
  retake: string;
  confirmProcessDocument: string;
  cancel: string;
  workspace: string;
  workspaceSettings: string;
  backToSettings: string;
  imagesOnlyPages: string;
  imagesOnlyRetake: string;
  addAtLeastOnePage: string;
  uploadingPages: string;

  statusActive: string;
  statusClosed: string;
  statusArchived: string;
  statusUploading: string;
  statusProcessing: string;
  statusReady: string;
  statusFailed: string;
  statusNeedsAttention: string;
  statusThinking: string;
  statusWorking: string;
  statusWaitingApproval: string;
  statusComplete: string;
  statusCancelled: string;
  statusIncomplete: string;

  provenanceConfirmed: string;
  provenanceUser: string;
  provenanceDocument: string;
  provenanceConversation: string;
  provenanceAi: string;
  provenanceSystem: string;

  sourceOfficial: string;
  sourceCourt: string;
  sourceLegislation: string;
  sourceMatterDocument: string;
  sourceWeb: string;

  improve: string;
  makeConcise: string;
  moreFormal: string;
  addCitations: string;
  checkAgainstMatter: string;
  draftAiHint: string;
  responseDocument: string;

  legalResearch: string;
  viewAllMatters: string;

  tourRestart: string;
  tourRestartHint: string;
  demoStart: string;
  demoPageBody: string;
  demoPreparing: string;
  demoFailed: string;
  demoNoWorkspace: string;
  demoMatterTitle: string;
  demoMatterDescription: string;
  demoGuideSetupTitle: string;
  demoGuideSetupBody: string;
  demoGuideOverviewTitle: string;
  demoGuideOverviewBody: string;
  demoGuideResearchTitle: string;
  demoGuideResearchBody: string;
  demoGuideDraftTitle: string;
  demoGuideDraftBody: string;
  demoGuideDoneTitle: string;
  demoGuideDoneBody: string;
  demoGuideOnMatter: string;
  demoFactEmployeeKey: string;
  demoFactEmployeeValue: string;
  demoFactEmployerKey: string;
  demoFactEmployerValue: string;
  demoFactRoleKey: string;
  demoFactRoleValue: string;
  demoFactIssueKey: string;
  demoFactIssueValue: string;
  demoFactReliefKey: string;
  demoFactReliefValue: string;
  demoResearchQuery: string;
  demoDraftTask: string;
  aiDraftDefaultTitle: string;
  articleLabel: string;
  aiStepDraftCreated: string;
  aiStepDrafting: string;
  aiStepApprovalRequested: string;
  aiStepApprovalCreateDraft: string;
  aiStepApprovalSaveMemory: string;
  aiStepSearchingCorpus: string;
  aiStepSearchedCorpus: string;
  aiStepRetrievingProvision: string;
  aiStepRetrievedProvision: string;
  aiStepSearchingWeb: string;
  aiStepSearchedWeb: string;
  aiStepBuildContext: string;
  aiStepValidateCitations: string;
  aiStepConversationContext: string;
  aiStepReviewedFindings: string;
  aiStepValidateEvidence: string;
  aiStepRetrievedTarget: string;
  aiStepResearchTarget: string;
  aiStepRetryRetrieval: string;
  tourSkip: string;
  tourBack: string;
  tourNext: string;
  tourDone: string;
  tourProgress: string;
  tourWelcomeTitle: string;
  tourWelcomeBody: string;
  tourSidebarTitle: string;
  tourSidebarBody: string;
  tourNewMatterTitle: string;
  tourNewMatterBody: string;
  tourRecentMattersTitle: string;
  tourRecentMattersBody: string;
  tourShortcutsTitle: string;
  tourShortcutsBody: string;
  tourCommandTitle: string;
  tourCommandBody: string;
  tourShellDoneTitle: string;
  tourShellDoneBody: string;
  tourMatterTabsTitle: string;
  tourMatterTabsBody: string;
  tourAiActionsTitle: string;
  tourAiActionsBody: string;
  tourAiComposerTitle: string;
  tourAiComposerBody: string;
  tourMatterContextTitle: string;
  tourMatterContextBodyTour: string;
  tourAiDoneTitle: string;
  tourAiDoneBody: string;
};

const en: Messages = {
  brand: "Legal Workbench",
  brandTagline: "AI legal workspace",
  language: "Language",
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Night",
  themeSwitchToLight: "Switch to light mode",
  themeSwitchToDark: "Switch to night mode",
  home: "Home",
  matters: "Matters",
  clients: "Clients",
  documents: "Documents",
  settings: "Settings",
  menu: "Menu",
  close: "Close",
  signOut: "Sign out",
  signingOut: "Signing out…",
  commandPalette: "Command palette",
  landingEyebrow: "Middle East Legal Workbench",
  landingTitle: "Legal Workbench",
  landingBody:
    "A secure AI-native workspace for lawyers across the Middle East — starting with Egypt.",
  createAccount: "Create account",
  signIn: "Sign in",
  openWorkspace: "Open workspace",
  loginTitle: "Sign in",
  loginSubtitle: "Access your Legal Workbench account.",
  authShowcaseTitle: "Your matters, research, and drafts in one workspace",
  authShowcaseBody:
    "Open a case, ask grounded questions, and review AI drafts before anything leaves your desk.",
  authShotOverview: "Matter overview with case context and quick actions",
  authShotAi: "Matter AI workspace with research progress and follow-ups",
  authShotResearch: "Legal research answers with official-source citations",
  authShotApproval: "Human approval dialog for an AI-prepared draft notice",
  email: "Email",
  password: "Password",
  signingIn: "Signing in…",
  noAccount: "No account?",
  register: "Register",
  needConfirm: "Need to confirm your email?",
  resendConfirmation: "Resend confirmation",
  registerTitle: "Create account",
  registerSubtitle:
    "Register as a lawyer or client to start working in the legal workbench.",
  alreadyRegistered: "Already registered?",
  firstName: "First name",
  lastName: "Last name",
  role: "Role",
  lawyer: "Lawyer",
  client: "Client",
  creatingAccount: "Creating account…",
  verifyEyebrow: "Almost there",
  verifyTitle: "Confirm your email",
  verifyBodyBefore: "We sent a confirmation link to",
  verifyBodyInbox: "your inbox",
  verifyBodyAfter:
    ". Open the link to verify your account. The link expires and can be used once.",
  needNewLink: "Need a new link?",
  needNewLinkBody:
    "If the previous email expired, request another confirmation message.",
  alreadyVerified: "Already verified?",
  loginFailed: "Login failed",

  welcome: "Welcome",
  homeSubtitle:
    "Open a matter to research, review documents, and draft with AI — all in one legal workspace.",
  newMatter: "New matter",
  needsAttention: "Needs your attention",
  recentMatters: "Recent matters",
  viewAll: "View all",
  askAi: "Ask AI",
  openMatter: "Open matter",
  noMattersTitle: "No matters yet",
  noMattersBody:
    "Create a matter for a client dispute, transaction, or advisory file to start working with AI.",
  createMatter: "Create matter",
  publicLawResearch: "Public law research",
  publicLawResearchBody: "Search the legal corpus",
  documentsCardBody: "Upload and review matter files",
  settingsCardBody: "Account and workspaces",

  mattersTitle: "Matters",
  mattersSubtitle:
    "Your active legal files. Open a matter to work with AI, documents, research, and drafts.",
  updated: "Updated",

  clientsTitle: "Clients",
  clientsSubtitle:
    "Clients appear from your matters and confirmed Matter Context.",
  noClientsTitle: "No clients yet",
  noClientsBody:
    "Create a matter and save the client name to Matter Context. Clients will appear here automatically.",
  matterCount: "matter",
  mattersCount: "matters",

  documentsTitle: "Documents",
  documentsSubtitle: "All matter documents across your workspaces.",
  noDocumentsTitle: "No documents yet",
  noDocumentsBody:
    "Upload contracts, filings, correspondence, or other matter documents to get started.",
  openAMatter: "Open a matter",
  browseMatters: "Browse matters",
  pages: "pages",
  pagesPending: "Pages pending",
  searchDocuments: "Search documents…",
  upload: "Upload",
  uploadHint: "Upload PDF or image files for this matter.",
  takePhotos: "Take / add photos",
  takePhotosHint: "Add, reorder, and submit pages for text extraction.",

  settingsTitle: "Settings",
  settingsSubtitle: "Account, workspace, and access preferences.",
  account: "Account",
  name: "Name",
  workspaces: "Workspaces",
  workspacesBody: "Workspaces isolate practice areas, members, and matters.",
  createWorkspace: "Create workspace",
  noWorkspaces: "You are not a member of any workspace yet.",

  backToMatters: "Matters",
  yourRole: "Your role",
  approvalRequired: "Approval required",
  approvalRequiredBody: "The AI is waiting for your review before continuing.",
  reviewNow: "Review now",

  overview: "Overview",
  ai: "AI",
  research: "Research",
  drafts: "Drafts",
  activity: "Activity",

  whereThingsStand: "Where things stand",
  status: "Status",
  aiSummary: "AI summary",
  askAiForSummary: "Ask the AI to analyze this matter for a working summary.",
  reviewADocument: "Review a document",
  researchAnIssue: "Research an issue",
  draftADocument: "Draft a document",
  uploadDocuments: "Upload documents",
  recentActivity: "Recent activity",
  noActivityTitle: "No activity yet",
  noActivityBody:
    "Upload a document or ask the AI to get started on this matter.",
  participants: "Participants",
  updateMatter: "Update matter",

  matterContext: "Matter Context",
  matterContextBody: "What the AI knows about this matter.",
  keyFacts: "Key facts",
  preferences: "Preferences",
  suggestedUpdates: "Suggested updates",
  save: "Save",
  dontSave: "Don't save",
  contextNeedsDecision: "Context needs a decision",
  keepExisting: "Keep existing",
  useProposed: "Use proposed",
  noKeyFacts: "No key facts saved yet.",
  noPreferences: "No drafting or style preferences yet.",
  addToContext: "Add to context",
  label: "Label",
  value: "Value",
  edit: "Edit",
  remove: "Remove",
  clientLabel: "Client",

  matterAi: "Matter AI",
  whatWouldYouLike: "What would you like to do?",
  researchIssue: "Research an issue",
  reviewDocument: "Review a document",
  draftSomething: "Draft something",
  analyzeMatter: "Analyze this matter",
  askQuestion: "Ask a question",
  askAnything: "Ask anything about this matter…",
  askAnythingHint:
    "Ask anything about this matter. The AI will research, review, or draft as needed — you do not need to choose a mode.",
  send: "Send",
  working: "Working…",
  recentWork: "Recent work",
  noAiWork: "No AI work yet.",
  summary: "Summary",
  sources: "Sources",
  draftPreview: "Draft preview",
  openInEditor: "Open in editor",
  hideContext: "Hide context",
  showContext: "Matter context",
  onlyLawyersAi: "Only lawyers can run AI actions in this matter.",
  enterRequest: "Enter a request for the AI.",
  aiRequestFailed: "AI request failed",
  examplesPrompt:
    "Examples: Review this contract. Draft a response. What does Egyptian law say about this?",
  loadingMatterAi: "Loading Matter AI…",

  researchTitle: "Research",
  researchSubtitle:
    "Investigate a legal question using authoritative sources. Matter documents stay separate from public law research.",
  researchWithAi: "Research with AI",
  whatResearching: "What are you researching?",
  researchPreferOfficial:
    "Prefer official legislation and court sources. Secondary commentary is shown with lower priority.",
  needFullerWorkflow: "Need a fuller workflow?",
  needFullerWorkflowBody:
    "Ask AI to research an issue, compare findings with matter documents, and prepare next steps.",
  startInMatterAi: "Start in Matter AI",

  draftsTitle: "Drafts",
  draftsSubtitle:
    "Letters, memos, and other documents prepared with AI assistance.",
  newDraft: "New draft",
  lastEdited: "Last edited",
  noDraftsTitle: "No drafts yet",
  noDraftsBody:
    "Create a letter, memo, pleading, or other legal document with AI assistance.",
  createDraft: "Create draft",
  backToDrafts: "Drafts",

  activityTitle: "Activity",
  activitySubtitle:
    "A transparent timeline of uploads, AI work, and approvals.",
  today: "Today",
  yesterday: "Yesterday",

  evidence: "Evidence",
  openSource: "Open source",
  openSourceHint: "Open the source to inspect the full text.",

  issuesFound: "issues found",
  issueFound: "issue found",
  high: "High",
  medium: "Medium",
  informational: "Informational",
  recommended: "Recommended",
  view: "View",

  approvalTitle: "Approval required",
  approvalDraftBody: "The AI prepared something that needs your review",
  approvalMemoryTitle: "Save to Matter Context?",
  approvalInferred:
    "This was inferred or proposed by the AI. Confirm before it becomes Matter Context.",
  proposedDraft: "Proposed draft",
  approve: "Approve",
  reject: "Reject",
  review: "Review",
  itemsNeedReview: "items need your review before the AI can continue.",
  oneItemNeedsReview: "The AI needs your review before continuing.",

  workingOnRequest: "Working on your request…",
  latestProgress: "Latest AI progress",
  viewDetails: "View details",
  hideDetails: "Hide details",
  researchCompleted: "Research completed",
  researchFailed: "Research failed",
  executionSteps: "steps",
  evidenceItemsCount: "evidence items",
  legalProvisionsCount: "legal provisions",
  followUpPlaceholder: "Ask a follow-up…",
  copyResponse: "Copy",
  copied: "Copied",
  regenerate: "Regenerate",
  you: "You",
  askFollowUp: "Ask a follow-up about this matter…",
  newConversation: "New conversation",

  document: "Document",
  backToDocuments: "Documents",
  askAboutDocument: "Ask about this document",
  extractedTextHint:
    "Extracted text the AI can use when analyzing this document.",
  citationsOpenPage: "Original file. Citations can open the relevant page here.",
  pageLabel: "Page",
  noTextExtracted: "(No text extracted)",
  extractingText: "Extracting text…",
  noExtractedText: "No extracted text yet.",
  previewUnavailable: "Preview unavailable.",
  downloadOriginal: "Download original",
  draftLabel: "Draft",
  draftPlaceholder: "Draft text will appear here…",
  sourceRun: "Source run",
  goToHome: "Go to Home",
  browseClients: "Browse Clients",
  browseDocumentsNav: "Browse Documents",
  navigate: "Navigate",
  commandSearchPlaceholder: "Search matters, documents, research, or AI…",
  commandWhatToDo: "What do you want to do?",
  closeCommandPalette: "Close command palette",
  askAiDash: "Ask AI —",
  researchDash: "Research —",
  draftDash: "Draft —",
  question: "Question",
  researching: "Researching…",
  searchingOfficial: "Searching official legal sources…",
  answer: "Answer",
  viewAnalysisDetails: "View analysis details",
  legalQuestionPlaceholder:
    "What does Article 25 of the Egyptian Constitution say?",
  primaryOfficial: "Primary / Official",
  webResearch: "Web research",
  researchSource: "Research source",
  officialLegalSources: "Official legal sources",
  internet: "Internet",
  both: "Both",
  internetMatterOnly:
    "Internet and Both are available from a Matter research panel.",
  noMatches: "No matches.",
  commandPaletteFooter: "Esc to close · ⌘K / Ctrl+K to toggle",
  court: "Court",
  secondary: "Secondary",
  uploading: "Uploading…",
  processingDocument: "Processing document…",
  choosePdfOrImage: "Choose a PDF or image file",
  uploadFailed: "Upload failed",
  documentReady: "Document ready",
  uploadedProcessingFailed:
    "Uploaded, but processing failed. You can retry from the list.",
  uploadPdfOrImage: "Upload PDF or image",
  uploadDocument: "Upload document",
  deleteDocumentConfirm: "Delete this document? This cannot be undone.",
  deleteFailed: "Delete failed",
  deleting: "Deleting…",
  delete: "Delete",
  retryFailed: "Retry failed",
  retrying: "Retrying…",
  retry: "Retry",
  documentTitleOptional: "Document title (optional)",
  courtFilingPhotos: "Court filing photos",
  takeSelectPhotos: "Take / select photos",
  pagesReady: "ready",
  up: "Up",
  down: "Down",
  retake: "Retake",
  confirmProcessDocument: "Confirm & process document",
  cancel: "Cancel",
  workspace: "Workspace",
  workspaceSettings: "Workspace settings",
  backToSettings: "Settings",
  imagesOnlyPages: "Only image files can be added as photo pages",
  imagesOnlyRetake: "Only image files can be used to retake a page",
  addAtLeastOnePage: "Add at least one page",
  uploadingPages: "Uploading pages…",

  statusActive: "Active",
  statusClosed: "Closed",
  statusArchived: "Archived",
  statusUploading: "Uploading…",
  statusProcessing: "Processing…",
  statusReady: "Ready",
  statusFailed: "Failed",
  statusNeedsAttention: "Needs attention",
  statusThinking: "Thinking…",
  statusWorking: "Working…",
  statusWaitingApproval: "Waiting for approval",
  statusComplete: "Complete",
  statusCancelled: "Cancelled",
  statusIncomplete: "Incomplete",

  provenanceConfirmed: "Confirmed",
  provenanceUser: "User provided",
  provenanceDocument: "Document-derived",
  provenanceConversation: "From conversation",
  provenanceAi: "AI-derived",
  provenanceSystem: "System",

  sourceOfficial: "Official source",
  sourceCourt: "Court",
  sourceLegislation: "Legislation",
  sourceMatterDocument: "Matter document",
  sourceWeb: "Web research",

  improve: "Improve",
  makeConcise: "Make concise",
  moreFormal: "More formal",
  addCitations: "Add citations",
  checkAgainstMatter: "Check against Matter",
  draftAiHint:
    "You stay in control of the document. AI suggestions require approval when they create or replace a draft.",
  responseDocument: "Response document",

  legalResearch: "Legal research",
  viewAllMatters: "View all",

  tourRestart: "Replay tutorial",
  tourRestartHint:
    "Walk through the workbench again — home navigation and the matter AI tips.",
  demoStart: "Workflow demo",
  demoPageBody:
    "Creates a matter, adds key facts, runs constitution research, and drafts a letter — inside the real workbench screens.",
  demoPreparing: "Creating the demo matter and key facts…",
  demoFailed: "The demo failed. Try again.",
  demoNoWorkspace: "Create a workspace before running the demo.",
  demoMatterTitle: "Demo employment termination",
  demoMatterDescription:
    "Live workflow demo matter: unfair dismissal / notice claim for Amira Hassan against Cairo Tech LLC.",
  demoGuideSetupTitle: "Setting up the demo",
  demoGuideSetupBody:
    "Creating a new employment matter and saving key facts into matter memory.",
  demoGuideOverviewTitle: "Matter overview + key facts",
  demoGuideOverviewBody:
    "This is a real matter. Open Matter context on the right to see the key facts we just saved — the same place you’d add facts while working a case.",
  demoGuideResearchTitle: "Legal research",
  demoGuideResearchBody:
    "This is the Research tab. We filled a constitution question and ran it against official sources — watch the answer and citations appear in this screen.",
  demoGuideDraftTitle: "Draft with Matter AI",
  demoGuideDraftBody:
    "Matter AI is drafting a demand letter from the facts and research. Watch the run here; approve the draft when the approval prompt appears.",
  demoGuideDoneTitle: "Drafts list",
  demoGuideDoneBody:
    "Draft runs show up here for review. Open one anytime, or keep exploring the matter tabs. You can rerun this demo from the sidebar.",
  demoGuideOnMatter: "Using the live matter UI",
  demoFactEmployeeKey: "employee_name",
  demoFactEmployeeValue: "Amira Hassan",
  demoFactEmployerKey: "employer",
  demoFactEmployerValue: "Cairo Tech LLC",
  demoFactRoleKey: "role",
  demoFactRoleValue: "Product Counsel",
  demoFactIssueKey: "issue",
  demoFactIssueValue:
    "Employment terminated without notice on 15 September 2025; employee claims 30 days' pay in lieu of notice.",
  demoFactReliefKey: "requested_relief",
  demoFactReliefValue:
    "Payment in lieu of notice and written confirmation of termination grounds.",
  demoResearchQuery:
    "What does the Egyptian Constitution say about equality before the law and the right to work?",
  demoDraftTask:
    "Using the matter key facts and Egyptian constitutional principles on equality and work, draft a short formal demand letter from counsel for Amira Hassan to Cairo Tech LLC requesting payment in lieu of 30 days' notice and written reasons for termination. Keep it concise and cite constitutional principles where relevant.",
  aiDraftDefaultTitle: "Demand letter",
  articleLabel: "Article",
  aiStepDraftCreated: 'Draft created: "{title}"',
  aiStepDrafting: "Drafting…",
  aiStepApprovalRequested: "Approval requested",
  aiStepApprovalCreateDraft: "Approve draft",
  aiStepApprovalSaveMemory: "Save matter memory",
  aiStepSearchingCorpus: "Searching legal corpus…",
  aiStepSearchedCorpus: "Searched legal corpus",
  aiStepRetrievingProvision: "Retrieving legal provision…",
  aiStepRetrievedProvision: "Retrieved legal provision",
  aiStepSearchingWeb: "Searching the web…",
  aiStepSearchedWeb: "Searched the web",
  aiStepBuildContext: "Built legal context",
  aiStepValidateCitations: "Validated citations",
  aiStepConversationContext: "Understood conversation context",
  aiStepReviewedFindings: "Reviewed findings",
  aiStepValidateEvidence: "Validated evidence",
  aiStepRetrievedTarget: "Retrieved target provision",
  aiStepResearchTarget: "Identified research target",
  aiStepRetryRetrieval: "Retrying targeted retrieval",
  tourSkip: "Skip",
  tourBack: "Back",
  tourNext: "Next",
  tourDone: "Done",
  tourProgress: "Step {current} of {total}",
  tourWelcomeTitle: "Welcome to Legal Workbench",
  tourWelcomeBody:
    "A quick walkthrough of the workspace — navigation, matters, and where AI helps. Takes about a minute.",
  tourSidebarTitle: "Your navigation",
  tourSidebarBody:
    "Jump between Home, Matters, Clients, Documents, and Settings from the sidebar. Collapse it anytime with the menu button.",
  tourNewMatterTitle: "Start a new matter",
  tourNewMatterBody:
    "Create a matter to keep documents, research, drafts, and AI conversations together for one case.",
  tourRecentMattersTitle: "Your recent matters",
  tourRecentMattersBody:
    "Open a matter to review its overview, or choose Ask AI to work with the assistant on that case.",
  tourShortcutsTitle: "Documents, research, and settings",
  tourShortcutsBody:
    "Browse matter documents, run public-law research, or manage workspaces and account settings from these shortcuts.",
  tourCommandTitle: "Command palette",
  tourCommandBody:
    "Press ⌘K (or Ctrl+K) anywhere to search matters and jump to common actions without leaving the keyboard.",
  tourShellDoneTitle: "You're ready",
  tourShellDoneBody:
    "Open a matter and go to the AI tab for the next short tip set. You can replay this tour anytime from the sidebar.",
  tourMatterTabsTitle: "Matter sections",
  tourMatterTabsBody:
    "Each matter has Overview, AI, Documents, Research, Drafts, and Activity — switch tabs to move through the workflow.",
  tourAiActionsTitle: "Quick AI actions",
  tourAiActionsBody:
    "Start with a suggested task — research, drafting, or review — or type your own request below.",
  tourAiComposerTitle: "Ask about this matter",
  tourAiComposerBody:
    "Describe what you need. The assistant uses this matter’s context and documents, and may ask for approval before sensitive actions.",
  tourMatterContextTitle: "Matter context",
  tourMatterContextBodyTour:
    "Facts, memory, and document counts live here so the AI stays grounded in what you already know about the case.",
  tourAiDoneTitle: "Start working",
  tourAiDoneBody:
    "Try a question or a quick action. Citations and evidence open in a side drawer when the assistant references sources.",
};

const fr: Messages = {
  ...en,
  brand: "Legal Workbench",
  brandTagline: "Espace juridique IA",
  language: "Langue",
  theme: "Thème",
  themeLight: "Clair",
  themeDark: "Nuit",
  themeSwitchToLight: "Passer en mode clair",
  themeSwitchToDark: "Passer en mode nuit",
  home: "Accueil",
  matters: "Dossiers",
  clients: "Clients",
  documents: "Documents",
  settings: "Paramètres",
  menu: "Menu",
  close: "Fermer",
  signOut: "Se déconnecter",
  signingOut: "Déconnexion…",
  commandPalette: "Palette de commandes",
  landingEyebrow: "Espace juridique Moyen-Orient",
  landingTitle: "Legal Workbench",
  landingBody:
    "Un espace sécurisé et natif IA pour les avocats du Moyen-Orient — en commençant par l’Égypte.",
  createAccount: "Créer un compte",
  signIn: "Se connecter",
  openWorkspace: "Ouvrir l’espace",
  loginTitle: "Connexion",
  loginSubtitle: "Accédez à votre compte Legal Workbench.",
  authShowcaseTitle:
    "Dossiers, recherche et brouillons dans un même espace",
  authShowcaseBody:
    "Ouvrez une affaire, posez des questions ancrées, et validez les brouillons IA avant qu’ils ne quittent votre bureau.",
  authShotOverview: "Vue d’ensemble du dossier avec contexte et actions rapides",
  authShotAi: "Espace IA du dossier avec progression de recherche",
  authShotResearch: "Réponses de recherche juridique avec citations officielles",
  authShotApproval: "Dialogue d’approbation pour un projet de mise en demeure",
  email: "E-mail",
  password: "Mot de passe",
  signingIn: "Connexion…",
  noAccount: "Pas de compte ?",
  register: "S’inscrire",
  needConfirm: "Besoin de confirmer votre e-mail ?",
  resendConfirmation: "Renvoyer la confirmation",
  registerTitle: "Créer un compte",
  registerSubtitle:
    "Inscrivez-vous en tant qu’avocat ou client pour commencer.",
  alreadyRegistered: "Déjà inscrit ?",
  firstName: "Prénom",
  lastName: "Nom",
  role: "Rôle",
  lawyer: "Avocat",
  client: "Client",
  creatingAccount: "Création du compte…",
  verifyEyebrow: "Presque terminé",
  verifyTitle: "Confirmez votre e-mail",
  verifyBodyBefore: "Nous avons envoyé un lien de confirmation à",
  verifyBodyInbox: "votre boîte de réception",
  verifyBodyAfter:
    ". Ouvrez le lien pour vérifier votre compte. Le lien expire et ne peut être utilisé qu’une fois.",
  needNewLink: "Besoin d’un nouveau lien ?",
  needNewLinkBody:
    "Si l’e-mail précédent a expiré, demandez un nouveau message de confirmation.",
  alreadyVerified: "Déjà vérifié ?",
  loginFailed: "Échec de la connexion",

  welcome: "Bienvenue",
  homeSubtitle:
    "Ouvrez un dossier pour rechercher, examiner des documents et rédiger avec l’IA — dans un seul espace juridique.",
  newMatter: "Nouveau dossier",
  needsAttention: "Nécessite votre attention",
  recentMatters: "Dossiers récents",
  viewAll: "Tout voir",
  askAi: "Demander à l’IA",
  openMatter: "Ouvrir le dossier",
  noMattersTitle: "Aucun dossier pour le moment",
  noMattersBody:
    "Créez un dossier pour un litige, une transaction ou un conseil afin de commencer avec l’IA.",
  createMatter: "Créer un dossier",
  publicLawResearch: "Recherche juridique publique",
  publicLawResearchBody: "Rechercher dans le corpus juridique",
  documentsCardBody: "Téléverser et examiner les fichiers du dossier",
  settingsCardBody: "Compte et espaces de travail",

  mattersTitle: "Dossiers",
  mattersSubtitle:
    "Vos dossiers juridiques actifs. Ouvrez un dossier pour travailler avec l’IA, les documents, la recherche et les projets.",
  updated: "Mis à jour",

  clientsTitle: "Clients",
  clientsSubtitle:
    "Les clients apparaissent depuis vos dossiers et le contexte confirmé.",
  noClientsTitle: "Aucun client pour le moment",
  noClientsBody:
    "Créez un dossier et enregistrez le nom du client dans le contexte. Les clients apparaîtront ici automatiquement.",
  matterCount: "dossier",
  mattersCount: "dossiers",

  documentsTitle: "Documents",
  documentsSubtitle: "Tous les documents de dossier dans vos espaces.",
  noDocumentsTitle: "Aucun document pour le moment",
  noDocumentsBody:
    "Téléversez des contrats, actes, correspondances ou autres documents pour commencer.",
  openAMatter: "Ouvrir un dossier",
  browseMatters: "Parcourir les dossiers",
  pages: "pages",
  pagesPending: "Pages en attente",
  searchDocuments: "Rechercher des documents…",
  upload: "Téléverser",
  uploadHint: "Téléversez des PDF ou images pour ce dossier.",
  takePhotos: "Prendre / ajouter des photos",
  takePhotosHint:
    "Ajoutez, réorganisez et soumettez des pages pour l’extraction de texte.",

  settingsTitle: "Paramètres",
  settingsSubtitle: "Compte, espace de travail et préférences d’accès.",
  account: "Compte",
  name: "Nom",
  workspaces: "Espaces de travail",
  workspacesBody:
    "Les espaces isolent les domaines de pratique, membres et dossiers.",
  createWorkspace: "Créer un espace",
  noWorkspaces: "Vous n’êtes membre d’aucun espace pour le moment.",

  backToMatters: "Dossiers",
  yourRole: "Votre rôle",
  approvalRequired: "Approbation requise",
  approvalRequiredBody: "L’IA attend votre révision avant de continuer.",
  reviewNow: "Réviser maintenant",

  overview: "Aperçu",
  ai: "IA",
  research: "Recherche",
  drafts: "Brouillons",
  activity: "Activité",

  whereThingsStand: "Où en est le dossier",
  status: "Statut",
  aiSummary: "Résumé IA",
  askAiForSummary: "Demandez à l’IA d’analyser ce dossier pour un résumé.",
  reviewADocument: "Examiner un document",
  researchAnIssue: "Rechercher une question",
  draftADocument: "Rédiger un document",
  uploadDocuments: "Téléverser des documents",
  recentActivity: "Activité récente",
  noActivityTitle: "Aucune activité pour le moment",
  noActivityBody:
    "Téléversez un document ou demandez à l’IA pour commencer sur ce dossier.",
  participants: "Participants",
  updateMatter: "Mettre à jour le dossier",

  matterContext: "Contexte du dossier",
  matterContextBody: "Ce que l’IA sait de ce dossier.",
  keyFacts: "Faits clés",
  preferences: "Préférences",
  suggestedUpdates: "Mises à jour suggérées",
  save: "Enregistrer",
  dontSave: "Ne pas enregistrer",
  contextNeedsDecision: "Le contexte nécessite une décision",
  keepExisting: "Conserver l’existant",
  useProposed: "Utiliser la proposition",
  noKeyFacts: "Aucun fait clé enregistré pour le moment.",
  noPreferences: "Aucune préférence de rédaction pour le moment.",
  addToContext: "Ajouter au contexte",
  label: "Libellé",
  value: "Valeur",
  edit: "Modifier",
  remove: "Retirer",
  clientLabel: "Client",

  matterAi: "IA du dossier",
  whatWouldYouLike: "Que souhaitez-vous faire ?",
  researchIssue: "Rechercher une question",
  reviewDocument: "Examiner un document",
  draftSomething: "Rédiger quelque chose",
  analyzeMatter: "Analyser ce dossier",
  askQuestion: "Poser une question",
  askAnything: "Posez une question sur ce dossier…",
  askAnythingHint:
    "Posez n’importe quelle question sur ce dossier. L’IA recherchera, examinera ou rédigera selon le besoin — sans choisir de mode.",
  send: "Envoyer",
  working: "Travail en cours…",
  recentWork: "Travail récent",
  noAiWork: "Aucun travail IA pour le moment.",
  summary: "Résumé",
  sources: "Sources",
  draftPreview: "Aperçu du brouillon",
  openInEditor: "Ouvrir dans l’éditeur",
  hideContext: "Masquer le contexte",
  showContext: "Contexte du dossier",
  onlyLawyersAi: "Seuls les avocats peuvent lancer des actions IA ici.",
  enterRequest: "Saisissez une demande pour l’IA.",
  aiRequestFailed: "Échec de la demande IA",
  examplesPrompt:
    "Exemples : Examiner ce contrat. Rédiger une réponse. Que dit le droit égyptien ?",
  loadingMatterAi: "Chargement de l’IA du dossier…",

  researchTitle: "Recherche",
  researchSubtitle:
    "Examinez une question juridique à partir de sources autoritaires. Les documents du dossier restent séparés.",
  researchWithAi: "Rechercher avec l’IA",
  whatResearching: "Que recherchez-vous ?",
  researchPreferOfficial:
    "Priorisez la législation officielle et les décisions de justice. Les sources secondaires ont une priorité moindre.",
  needFullerWorkflow: "Besoin d’un flux plus complet ?",
  needFullerWorkflowBody:
    "Demandez à l’IA de rechercher une question, comparer avec les documents et préparer les prochaines étapes.",
  startInMatterAi: "Commencer dans l’IA du dossier",

  draftsTitle: "Brouillons",
  draftsSubtitle:
    "Lettres, notes et autres documents préparés avec l’aide de l’IA.",
  newDraft: "Nouveau brouillon",
  lastEdited: "Dernière modification",
  noDraftsTitle: "Aucun brouillon pour le moment",
  noDraftsBody:
    "Créez une lettre, une note, un acte ou un autre document juridique avec l’IA.",
  createDraft: "Créer un brouillon",
  backToDrafts: "Brouillons",

  activityTitle: "Activité",
  activitySubtitle:
    "Une chronologie transparente des téléversements, du travail IA et des approbations.",
  today: "Aujourd’hui",
  yesterday: "Hier",

  evidence: "Preuve",
  openSource: "Ouvrir la source",
  openSourceHint: "Ouvrez la source pour consulter le texte complet.",

  issuesFound: "problèmes trouvés",
  issueFound: "problème trouvé",
  high: "Élevé",
  medium: "Moyen",
  informational: "Information",
  recommended: "Recommandé",
  view: "Voir",

  approvalTitle: "Approbation requise",
  approvalDraftBody: "L’IA a préparé quelque chose qui nécessite votre révision",
  approvalMemoryTitle: "Enregistrer dans le contexte du dossier ?",
  approvalInferred:
    "Ceci a été déduit ou proposé par l’IA. Confirmez avant que cela devienne le contexte du dossier.",
  proposedDraft: "Brouillon proposé",
  approve: "Approuver",
  reject: "Rejeter",
  review: "Réviser",
  itemsNeedReview:
    "éléments nécessitent votre révision avant que l’IA puisse continuer.",
  oneItemNeedsReview: "L’IA a besoin de votre révision avant de continuer.",

  workingOnRequest: "Traitement de votre demande…",
  latestProgress: "Dernière progression IA",
  viewDetails: "Voir les détails",
  hideDetails: "Masquer les détails",
  researchCompleted: "Recherche terminée",
  researchFailed: "Échec de la recherche",
  executionSteps: "étapes",
  evidenceItemsCount: "éléments de preuve",
  legalProvisionsCount: "dispositions juridiques",
  followUpPlaceholder: "Posez une question de suivi…",
  copyResponse: "Copier",
  copied: "Copié",
  regenerate: "Régénérer",
  you: "Vous",
  askFollowUp: "Posez une question de suivi sur ce dossier…",
  newConversation: "Nouvelle conversation",

  document: "Document",
  backToDocuments: "Documents",
  askAboutDocument: "Poser une question sur ce document",
  extractedTextHint:
    "Texte extrait que l’IA peut utiliser pour analyser ce document.",
  citationsOpenPage:
    "Fichier original. Les citations peuvent ouvrir la page concernée ici.",
  pageLabel: "Page",
  noTextExtracted: "(Aucun texte extrait)",
  extractingText: "Extraction du texte…",
  noExtractedText: "Aucun texte extrait pour le moment.",
  previewUnavailable: "Aperçu indisponible.",
  downloadOriginal: "Télécharger l’original",
  draftLabel: "Brouillon",
  draftPlaceholder: "Le texte du brouillon apparaîtra ici…",
  sourceRun: "Exécution source",
  goToHome: "Aller à l’accueil",
  browseClients: "Parcourir les clients",
  browseDocumentsNav: "Parcourir les documents",
  navigate: "Navigation",
  commandSearchPlaceholder:
    "Rechercher des dossiers, documents, recherches ou IA…",
  commandWhatToDo: "Que souhaitez-vous faire ?",
  closeCommandPalette: "Fermer la palette de commandes",
  askAiDash: "Demander à l’IA —",
  researchDash: "Recherche —",
  draftDash: "Brouillon —",
  question: "Question",
  researching: "Recherche…",
  searchingOfficial: "Recherche dans les sources juridiques officielles…",
  answer: "Réponse",
  viewAnalysisDetails: "Voir les détails d’analyse",
  legalQuestionPlaceholder:
    "Que dit l’article 25 de la Constitution égyptienne ?",
  primaryOfficial: "Primaire / Officiel",
  webResearch: "Recherche web",
  researchSource: "Source de recherche",
  officialLegalSources: "Sources juridiques officielles",
  internet: "Internet",
  both: "Les deux",
  internetMatterOnly:
    "Internet et Les deux sont disponibles depuis le panneau de recherche d’un dossier.",
  noMatches: "Aucun résultat.",
  commandPaletteFooter: "Échap pour fermer · ⌘K / Ctrl+K pour basculer",
  court: "Tribunal",
  secondary: "Secondaire",
  uploading: "Téléversement…",
  processingDocument: "Traitement du document…",
  choosePdfOrImage: "Choisissez un PDF ou une image",
  uploadFailed: "Échec du téléversement",
  documentReady: "Document prêt",
  uploadedProcessingFailed:
    "Téléversé, mais le traitement a échoué. Vous pouvez réessayer depuis la liste.",
  uploadPdfOrImage: "Téléverser un PDF ou une image",
  uploadDocument: "Téléverser le document",
  deleteDocumentConfirm:
    "Supprimer ce document ? Cette action est irréversible.",
  deleteFailed: "Échec de la suppression",
  deleting: "Suppression…",
  delete: "Supprimer",
  retryFailed: "Échec de la nouvelle tentative",
  retrying: "Nouvelle tentative…",
  retry: "Réessayer",
  documentTitleOptional: "Titre du document (facultatif)",
  courtFilingPhotos: "Photos de dépôt au tribunal",
  takeSelectPhotos: "Prendre / sélectionner des photos",
  pagesReady: "prêtes",
  up: "Haut",
  down: "Bas",
  retake: "Reprendre",
  confirmProcessDocument: "Confirmer et traiter le document",
  cancel: "Annuler",
  workspace: "Espace de travail",
  workspaceSettings: "Paramètres de l’espace",
  backToSettings: "Paramètres",
  imagesOnlyPages: "Seules les images peuvent être ajoutées comme pages photo",
  imagesOnlyRetake:
    "Seules les images peuvent être utilisées pour reprendre une page",
  addAtLeastOnePage: "Ajoutez au moins une page",
  uploadingPages: "Téléversement des pages…",

  statusActive: "Actif",
  statusClosed: "Clos",
  statusArchived: "Archivé",
  statusUploading: "Téléversement…",
  statusProcessing: "Traitement…",
  statusReady: "Prêt",
  statusFailed: "Échec",
  statusNeedsAttention: "Nécessite une attention",
  statusThinking: "Réflexion…",
  statusWorking: "Travail en cours…",
  statusWaitingApproval: "En attente d’approbation",
  statusComplete: "Terminé",
  statusCancelled: "Annulé",
  statusIncomplete: "Incomplet",

  provenanceConfirmed: "Confirmé",
  provenanceUser: "Fourni par l’utilisateur",
  provenanceDocument: "Issu du document",
  provenanceConversation: "Issu de la conversation",
  provenanceAi: "Issu de l’IA",
  provenanceSystem: "Système",

  sourceOfficial: "Source officielle",
  sourceCourt: "Tribunal",
  sourceLegislation: "Législation",
  sourceMatterDocument: "Document du dossier",
  sourceWeb: "Recherche web",

  improve: "Améliorer",
  makeConcise: "Rendre plus concis",
  moreFormal: "Plus formel",
  addCitations: "Ajouter des citations",
  checkAgainstMatter: "Vérifier par rapport au dossier",
  draftAiHint:
    "Vous restez maître du document. Les suggestions IA nécessitent une approbation lorsqu’elles créent ou remplacent un brouillon.",
  responseDocument: "Document de réponse",

  legalResearch: "Recherche juridique",
  viewAllMatters: "Tout voir",

  tourRestart: "Relancer le tutoriel",
  tourRestartHint:
    "Revoir le parcours de l’espace de travail — navigation et conseils IA du dossier.",
  demoStart: "Démo du flux",
  demoPageBody:
    "Crée un dossier, ajoute des faits, recherche dans la Constitution et rédige une lettre — dans les écrans réels de l’espace de travail.",
  demoPreparing: "Création du dossier démo et des faits clés…",
  demoFailed: "La démo a échoué. Réessayez.",
  demoNoWorkspace: "Créez un espace de travail avant de lancer la démo.",
  demoMatterTitle: "Démo licenciement",
  demoMatterDescription:
    "Dossier de démo : licenciement / préavis pour Amira Hassan contre Cairo Tech LLC.",
  demoGuideSetupTitle: "Préparation de la démo",
  demoGuideSetupBody:
    "Création d’un dossier d’emploi et enregistrement des faits clés dans la mémoire du dossier.",
  demoGuideOverviewTitle: "Aperçu du dossier + faits",
  demoGuideOverviewBody:
    "Voici un vrai dossier. Ouvrez Contexte du dossier à droite pour voir les faits enregistrés — comme vous le feriez en travaillant une affaire.",
  demoGuideResearchTitle: "Recherche juridique",
  demoGuideResearchBody:
    "Onglet Recherche : une question constitutionnelle a été lancée sur les sources officielles — regardez la réponse et les citations ici.",
  demoGuideDraftTitle: "Rédaction avec l’IA du dossier",
  demoGuideDraftBody:
    "L’IA rédige une mise en demeure à partir des faits et de la recherche. Suivez l’exécution ici et approuvez le brouillon lorsque demandé.",
  demoGuideDoneTitle: "Liste des brouillons",
  demoGuideDoneBody:
    "Les brouillons apparaissent ici pour relecture. Explorez les onglets du dossier. Relancez la démo depuis la barre latérale.",
  demoGuideOnMatter: "Interface réelle du dossier",
  demoFactEmployeeKey: "nom_employe",
  demoFactEmployeeValue: "Amira Hassan",
  demoFactEmployerKey: "employeur",
  demoFactEmployerValue: "Cairo Tech LLC",
  demoFactRoleKey: "poste",
  demoFactRoleValue: "Conseil produit",
  demoFactIssueKey: "litige",
  demoFactIssueValue:
    "Licenciement sans préavis le 15 septembre 2025 ; l’employée réclame 30 jours de salaire en lieu et place du préavis.",
  demoFactReliefKey: "demandes",
  demoFactReliefValue:
    "Paiement en lieu et place du préavis et confirmation écrite des motifs de licenciement.",
  demoResearchQuery:
    "Que dit la Constitution égyptienne sur l’égalité devant la loi et le droit au travail ?",
  demoDraftTask:
    "À partir des faits clés du dossier et des principes constitutionnels égyptiens sur l’égalité et le travail, rédigez une courte mise en demeure formelle au nom d’Amira Hassan adressée à Cairo Tech LLC, demandant le paiement de 30 jours de préavis et les motifs écrits du licenciement. Soyez concis et citez les principes constitutionnels pertinents.",
  aiDraftDefaultTitle: "Mise en demeure",
  articleLabel: "Article",
  aiStepDraftCreated: 'Brouillon créé : « {title} »',
  aiStepDrafting: "Rédaction…",
  aiStepApprovalRequested: "Approbation demandée",
  aiStepApprovalCreateDraft: "Approuver le brouillon",
  aiStepApprovalSaveMemory: "Enregistrer la mémoire du dossier",
  aiStepSearchingCorpus: "Recherche dans le corpus juridique…",
  aiStepSearchedCorpus: "Corpus juridique consulté",
  aiStepRetrievingProvision: "Récupération de la disposition…",
  aiStepRetrievedProvision: "Disposition récupérée",
  aiStepSearchingWeb: "Recherche sur le web…",
  aiStepSearchedWeb: "Web consulté",
  aiStepBuildContext: "Contexte juridique préparé",
  aiStepValidateCitations: "Citations validées",
  aiStepConversationContext: "Contexte de conversation compris",
  aiStepReviewedFindings: "Conclusions examinées",
  aiStepValidateEvidence: "Preuves validées",
  aiStepRetrievedTarget: "Disposition cible récupérée",
  aiStepResearchTarget: "Cible de recherche identifiée",
  aiStepRetryRetrieval: "Nouvelle tentative de récupération",
  tourSkip: "Passer",
  tourBack: "Retour",
  tourNext: "Suivant",
  tourDone: "Terminé",
  tourProgress: "Étape {current} sur {total}",
  tourWelcomeTitle: "Bienvenue dans Legal Workbench",
  tourWelcomeBody:
    "Un court parcours de l’espace de travail — navigation, dossiers et IA. Environ une minute.",
  tourSidebarTitle: "Votre navigation",
  tourSidebarBody:
    "Passez de l’Accueil aux Dossiers, Clients, Documents et Paramètres via la barre latérale. Repliez-la à tout moment.",
  tourNewMatterTitle: "Créer un nouveau dossier",
  tourNewMatterBody:
    "Créez un dossier pour regrouper documents, recherches, brouillons et conversations IA pour une affaire.",
  tourRecentMattersTitle: "Vos dossiers récents",
  tourRecentMattersBody:
    "Ouvrez un dossier pour voir l’aperçu, ou choisissez Demander à l’IA pour travailler avec l’assistant.",
  tourShortcutsTitle: "Documents, recherche et paramètres",
  tourShortcutsBody:
    "Parcourez les documents, lancez une recherche juridique publique, ou gérez les espaces de travail et le compte.",
  tourCommandTitle: "Palette de commandes",
  tourCommandBody:
    "Appuyez sur ⌘K (ou Ctrl+K) pour rechercher des dossiers et accéder aux actions courantes.",
  tourShellDoneTitle: "Vous êtes prêt",
  tourShellDoneBody:
    "Ouvrez un dossier et allez à l’onglet IA pour la suite. Vous pouvez relancer ce tutoriel depuis la barre latérale.",
  tourMatterTabsTitle: "Sections du dossier",
  tourMatterTabsBody:
    "Chaque dossier a Aperçu, IA, Documents, Recherche, Brouillons et Activité — changez d’onglet selon le flux de travail.",
  tourAiActionsTitle: "Actions IA rapides",
  tourAiActionsBody:
    "Commencez par une tâche suggérée — recherche, rédaction ou revue — ou saisissez votre demande ci-dessous.",
  tourAiComposerTitle: "Posez une question sur ce dossier",
  tourAiComposerBody:
    "Décrivez ce dont vous avez besoin. L’assistant utilise le contexte et les documents du dossier, et peut demander une approbation.",
  tourMatterContextTitle: "Contexte du dossier",
  tourMatterContextBodyTour:
    "Faits, mémoire et compteurs de documents restent ici pour ancrer l’IA dans ce que vous savez déjà de l’affaire.",
  tourAiDoneTitle: "Au travail",
  tourAiDoneBody:
    "Essayez une question ou une action rapide. Les citations s’ouvrent dans un tiroir latéral lorsque l’assistant cite des sources.",
};

const ar: Messages = {
  ...en,
  brand: "المنصة القانونية",
  brandTagline: "مساحة عمل قانونية بالذكاء الاصطناعي",
  language: "اللغة",
  theme: "المظهر",
  themeLight: "فاتح",
  themeDark: "ليلي",
  themeSwitchToLight: "التبديل إلى الوضع الفاتح",
  themeSwitchToDark: "التبديل إلى الوضع الليلي",
  home: "الرئيسية",
  matters: "القضايا",
  clients: "العملاء",
  documents: "المستندات",
  settings: "الإعدادات",
  menu: "القائمة",
  close: "إغلاق",
  signOut: "تسجيل الخروج",
  signingOut: "جارٍ تسجيل الخروج…",
  commandPalette: "لوحة الأوامر",
  landingEyebrow: "منصة قانونية للشرق الأوسط",
  landingTitle: "المنصة القانونية",
  landingBody:
    "مساحة عمل آمنة ومدعومة بالذكاء الاصطناعي للمحامين في الشرق الأوسط — بدءًا من مصر.",
  createAccount: "إنشاء حساب",
  signIn: "تسجيل الدخول",
  openWorkspace: "فتح مساحة العمل",
  loginTitle: "تسجيل الدخول",
  loginSubtitle: "ادخل إلى حسابك في المنصة القانونية.",
  authShowcaseTitle: "قضاياك وبحثك ومسوداتك في مساحة عمل واحدة",
  authShowcaseBody:
    "افتح قضية، واطرح أسئلة مبنية على مصادر موثوقة، وراجع مسودات الذكاء الاصطناعي قبل أن تغادر مكتبك.",
  authShotOverview: "نظرة عامة على القضية مع السياق والإجراءات السريعة",
  authShotAi: "مساحة ذكاء القضية الاصطناعي مع تقدم البحث",
  authShotResearch: "إجابات البحث القانوني مع اقتباسات من مصادر رسمية",
  authShotApproval: "حوار موافقة على مسودة إنذار أعدّها الذكاء الاصطناعي",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  signingIn: "جارٍ تسجيل الدخول…",
  noAccount: "ليس لديك حساب؟",
  register: "إنشاء حساب",
  needConfirm: "تحتاج إلى تأكيد بريدك الإلكتروني؟",
  resendConfirmation: "إعادة إرسال التأكيد",
  registerTitle: "إنشاء حساب",
  registerSubtitle: "سجّل كمحامٍ أو كعميل للبدء في مساحة العمل القانونية.",
  alreadyRegistered: "لديك حساب بالفعل؟",
  firstName: "الاسم الأول",
  lastName: "اسم العائلة",
  role: "الدور",
  lawyer: "محامٍ",
  client: "عميل",
  creatingAccount: "جارٍ إنشاء الحساب…",
  verifyEyebrow: "أوشكت على الانتهاء",
  verifyTitle: "أكد بريدك الإلكتروني",
  verifyBodyBefore: "أرسلنا رابط تأكيد إلى",
  verifyBodyInbox: "صندوق الوارد",
  verifyBodyAfter:
    ". افتح الرابط للتحقق من حسابك. ينتهي صلاحية الرابط ويمكن استخدامه مرة واحدة فقط.",
  needNewLink: "تحتاج إلى رابط جديد؟",
  needNewLinkBody:
    "إذا انتهت صلاحية الرسالة السابقة، اطلب رسالة تأكيد جديدة.",
  alreadyVerified: "تم التحقق بالفعل؟",
  loginFailed: "فشل تسجيل الدخول",

  welcome: "مرحبًا",
  homeSubtitle:
    "افتح قضية للبحث ومراجعة المستندات والصياغة بالذكاء الاصطناعي — في مساحة قانونية واحدة.",
  newMatter: "قضية جديدة",
  needsAttention: "يحتاج إلى انتباهك",
  recentMatters: "القضايا الأخيرة",
  viewAll: "عرض الكل",
  askAi: "اسأل الذكاء الاصطناعي",
  openMatter: "فتح القضية",
  noMattersTitle: "لا توجد قضايا بعد",
  noMattersBody:
    "أنشئ قضية لنزاع عميل أو معاملة أو استشارة للبدء مع الذكاء الاصطناعي.",
  createMatter: "إنشاء قضية",
  publicLawResearch: "بحث قانوني عام",
  publicLawResearchBody: "ابحث في المصادر القانونية",
  documentsCardBody: "ارفع وراجع ملفات القضية",
  settingsCardBody: "الحساب ومساحات العمل",

  mattersTitle: "القضايا",
  mattersSubtitle:
    "ملفاتك القانونية النشطة. افتح قضية للعمل مع الذكاء الاصطناعي والمستندات والبحث والمسودات.",
  updated: "آخر تحديث",

  clientsTitle: "العملاء",
  clientsSubtitle: "يظهر العملاء من قضاياك ومن سياق القضية المؤكد.",
  noClientsTitle: "لا يوجد عملاء بعد",
  noClientsBody:
    "أنشئ قضية واحفظ اسم العميل في سياق القضية. سيظهر العملاء هنا تلقائيًا.",
  matterCount: "قضية",
  mattersCount: "قضايا",

  documentsTitle: "المستندات",
  documentsSubtitle: "جميع مستندات القضايا عبر مساحات عملك.",
  noDocumentsTitle: "لا توجد مستندات بعد",
  noDocumentsBody:
    "ارفع العقود أو المذكرات أو المراسلات أو مستندات القضية الأخرى للبدء.",
  openAMatter: "افتح قضية",
  browseMatters: "تصفح القضايا",
  pages: "صفحات",
  pagesPending: "الصفحات قيد الانتظار",
  searchDocuments: "ابحث في المستندات…",
  upload: "رفع",
  uploadHint: "ارفع ملفات PDF أو صورًا لهذه القضية.",
  takePhotos: "التقاط / إضافة صور",
  takePhotosHint: "أضف الصفحات وأعد ترتيبها ثم أرسلها لاستخراج النص.",

  settingsTitle: "الإعدادات",
  settingsSubtitle: "الحساب ومساحة العمل وتفضيلات الوصول.",
  account: "الحساب",
  name: "الاسم",
  workspaces: "مساحات العمل",
  workspacesBody: "تعزل مساحات العمل مجالات الممارسة والأعضاء والقضايا.",
  createWorkspace: "إنشاء مساحة عمل",
  noWorkspaces: "لست عضوًا في أي مساحة عمل بعد.",

  backToMatters: "القضايا",
  yourRole: "دورك",
  approvalRequired: "مطلوب موافقة",
  approvalRequiredBody: "ينتظر الذكاء الاصطناعي مراجعتك قبل المتابعة.",
  reviewNow: "راجع الآن",

  overview: "نظرة عامة",
  ai: "الذكاء الاصطناعي",
  research: "البحث",
  drafts: "المسودات",
  activity: "النشاط",

  whereThingsStand: "وضع القضية الآن",
  status: "الحالة",
  aiSummary: "ملخص الذكاء الاصطناعي",
  askAiForSummary: "اطلب من الذكاء الاصطناعي تحليل هذه القضية لإعداد ملخص.",
  reviewADocument: "راجع مستندًا",
  researchAnIssue: "ابحث في مسألة",
  draftADocument: "صغ مستندًا",
  uploadDocuments: "ارفع مستندات",
  recentActivity: "النشاط الأخير",
  noActivityTitle: "لا يوجد نشاط بعد",
  noActivityBody: "ارفع مستندًا أو اسأل الذكاء الاصطناعي للبدء في هذه القضية.",
  participants: "المشاركون",
  updateMatter: "تحديث القضية",

  matterContext: "سياق القضية",
  matterContextBody: "ما يعرفه الذكاء الاصطناعي عن هذه القضية.",
  keyFacts: "الحقائق الأساسية",
  preferences: "التفضيلات",
  suggestedUpdates: "تحديثات مقترحة",
  save: "حفظ",
  dontSave: "عدم الحفظ",
  contextNeedsDecision: "السياق يحتاج إلى قرار",
  keepExisting: "الإبقاء على الحالي",
  useProposed: "استخدام المقترح",
  noKeyFacts: "لا توجد حقائق محفوظة بعد.",
  noPreferences: "لا توجد تفضيلات صياغة بعد.",
  addToContext: "إضافة إلى السياق",
  label: "التسمية",
  value: "القيمة",
  edit: "تعديل",
  remove: "إزالة",
  clientLabel: "العميل",

  matterAi: "ذكاء القضية الاصطناعي",
  whatWouldYouLike: "ماذا تريد أن تفعل؟",
  researchIssue: "ابحث في مسألة",
  reviewDocument: "راجع مستندًا",
  draftSomething: "صغ شيئًا",
  analyzeMatter: "حلّل هذه القضية",
  askQuestion: "اطرح سؤالًا",
  askAnything: "اسأل أي شيء عن هذه القضية…",
  askAnythingHint:
    "اسأل أي شيء عن هذه القضية. سيبحث الذكاء الاصطناعي أو يراجع أو يصيغ حسب الحاجة — دون اختيار وضع.",
  send: "إرسال",
  working: "جارٍ العمل…",
  recentWork: "العمل الأخير",
  noAiWork: "لا يوجد عمل للذكاء الاصطناعي بعد.",
  summary: "الملخص",
  sources: "المصادر",
  draftPreview: "معاينة المسودة",
  openInEditor: "فتح في المحرر",
  hideContext: "إخفاء السياق",
  showContext: "سياق القضية",
  onlyLawyersAi: "يمكن للمحامين فقط تشغيل إجراءات الذكاء الاصطناعي هنا.",
  enterRequest: "أدخل طلبًا للذكاء الاصطناعي.",
  aiRequestFailed: "فشل طلب الذكاء الاصطناعي",
  examplesPrompt:
    "أمثلة: راجع هذا العقد. صغ ردًا. ماذا يقول القانون المصري عن هذا؟",
  loadingMatterAi: "جارٍ تحميل ذكاء القضية الاصطناعي…",

  researchTitle: "البحث",
  researchSubtitle:
    "ابحث في مسألة قانونية باستخدام مصادر موثوقة. تبقى مستندات القضية منفصلة عن البحث العام.",
  researchWithAi: "ابحث بالذكاء الاصطناعي",
  whatResearching: "عمّ تبحث؟",
  researchPreferOfficial:
    "فضّل التشريعات الرسمية وأحكام المحاكم. تظهر المصادر الثانوية بأولوية أقل.",
  needFullerWorkflow: "تحتاج إلى سير عمل أكمل؟",
  needFullerWorkflowBody:
    "اطلب من الذكاء الاصطناعي البحث ومقارنة النتائج مع مستندات القضية وإعداد الخطوات التالية.",
  startInMatterAi: "ابدأ في ذكاء القضية الاصطناعي",

  draftsTitle: "المسودات",
  draftsSubtitle: "الخطابات والمذكرات والمستندات الأخرى بمساعدة الذكاء الاصطناعي.",
  newDraft: "مسودة جديدة",
  lastEdited: "آخر تعديل",
  noDraftsTitle: "لا توجد مسودات بعد",
  noDraftsBody:
    "أنشئ خطابًا أو مذكرة أو مرافعة أو مستندًا قانونيًا آخر بمساعدة الذكاء الاصطناعي.",
  createDraft: "إنشاء مسودة",
  backToDrafts: "المسودات",

  activityTitle: "النشاط",
  activitySubtitle: "سجل شفاف لعمليات الرفع وعمل الذكاء الاصطناعي والموافقات.",
  today: "اليوم",
  yesterday: "أمس",

  evidence: "الدليل",
  openSource: "فتح المصدر",
  openSourceHint: "افتح المصدر للاطلاع على النص الكامل.",

  issuesFound: "مسائل تم العثور عليها",
  issueFound: "مسألة تم العثور عليها",
  high: "مرتفع",
  medium: "متوسط",
  informational: "معلوماتي",
  recommended: "موصى به",
  view: "عرض",

  approvalTitle: "مطلوب موافقة",
  approvalDraftBody: "أعدّ الذكاء الاصطناعي شيئًا يحتاج إلى مراجعتك",
  approvalMemoryTitle: "الحفظ في سياق القضية؟",
  approvalInferred:
    "تم استنتاج هذا أو اقتراحه من الذكاء الاصطناعي. أكّد قبل أن يصبح جزءًا من سياق القضية.",
  proposedDraft: "المسودة المقترحة",
  approve: "موافقة",
  reject: "رفض",
  review: "مراجعة",
  itemsNeedReview: "عناصر تحتاج إلى مراجعتك قبل أن يواصل الذكاء الاصطناعي.",
  oneItemNeedsReview: "يحتاج الذكاء الاصطناعي إلى مراجعتك قبل المتابعة.",

  workingOnRequest: "جارٍ العمل على طلبك…",
  latestProgress: "آخر تقدم للذكاء الاصطناعي",
  viewDetails: "عرض التفاصيل",
  hideDetails: "إخفاء التفاصيل",
  researchCompleted: "اكتمل البحث",
  researchFailed: "فشل البحث",
  executionSteps: "خطوات",
  evidenceItemsCount: "عناصر أدلة",
  legalProvisionsCount: "أحكام قانونية",
  followUpPlaceholder: "اطرح سؤالاً متابعة…",
  copyResponse: "نسخ",
  copied: "تم النسخ",
  regenerate: "إعادة التوليد",
  you: "أنت",
  askFollowUp: "اطرح سؤالاً متابعة حول هذه القضية…",
  newConversation: "محادثة جديدة",

  document: "المستند",
  backToDocuments: "المستندات",
  askAboutDocument: "اسأل عن هذا المستند",
  extractedTextHint: "النص المستخرج الذي يمكن للذكاء الاصطناعي استخدامه عند التحليل.",
  citationsOpenPage: "الملف الأصلي. يمكن للاستشهادات فتح الصفحة ذات الصلة هنا.",
  pageLabel: "صفحة",
  noTextExtracted: "(لم يُستخرج نص)",
  extractingText: "جارٍ استخراج النص…",
  noExtractedText: "لا يوجد نص مستخرج بعد.",
  previewUnavailable: "المعاينة غير متاحة.",
  downloadOriginal: "تنزيل الأصل",
  draftLabel: "مسودة",
  draftPlaceholder: "سيظهر نص المسودة هنا…",
  sourceRun: "تشغيل المصدر",
  goToHome: "الانتقال إلى الصفحة الرئيسية",
  browseClients: "تصفح العملاء",
  browseDocumentsNav: "تصفح المستندات",
  navigate: "التنقل",
  commandSearchPlaceholder:
    "ابحث في القضايا أو المستندات أو البحوث أو الذكاء الاصطناعي…",
  commandWhatToDo: "ماذا تريد أن تفعل؟",
  closeCommandPalette: "إغلاق لوحة الأوامر",
  askAiDash: "اسأل الذكاء الاصطناعي —",
  researchDash: "بحث —",
  draftDash: "مسودة —",
  question: "السؤال",
  researching: "جارٍ البحث…",
  searchingOfficial: "جارٍ البحث في المصادر القانونية الرسمية…",
  answer: "الإجابة",
  viewAnalysisDetails: "عرض تفاصيل التحليل",
  legalQuestionPlaceholder: "ماذا تقول المادة 25 من الدستور المصري؟",
  primaryOfficial: "أساسي / رسمي",
  webResearch: "بحث على الويب",
  researchSource: "مصدر البحث",
  officialLegalSources: "المصادر القانونية الرسمية",
  internet: "الإنترنت",
  both: "كلاهما",
  internetMatterOnly:
    "الإنترنت وكلاهما متاحان من لوحة بحث القضية.",
  noMatches: "لا توجد نتائج.",
  commandPaletteFooter: "Esc للإغلاق · ⌘K / Ctrl+K للتبديل",
  court: "محكمة",
  secondary: "ثانوي",
  uploading: "جارٍ الرفع…",
  processingDocument: "جارٍ معالجة المستند…",
  choosePdfOrImage: "اختر ملف PDF أو صورة",
  uploadFailed: "فشل الرفع",
  documentReady: "المستند جاهز",
  uploadedProcessingFailed:
    "تم الرفع، لكن فشلت المعالجة. يمكنك إعادة المحاولة من القائمة.",
  uploadPdfOrImage: "ارفع PDF أو صورة",
  uploadDocument: "رفع المستند",
  deleteDocumentConfirm: "حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.",
  deleteFailed: "فشل الحذف",
  deleting: "جارٍ الحذف…",
  delete: "حذف",
  retryFailed: "فشلت إعادة المحاولة",
  retrying: "جارٍ إعادة المحاولة…",
  retry: "إعادة المحاولة",
  documentTitleOptional: "عنوان المستند (اختياري)",
  courtFilingPhotos: "صور إيداع المحكمة",
  takeSelectPhotos: "التقاط / اختيار صور",
  pagesReady: "جاهزة",
  up: "أعلى",
  down: "أسفل",
  retake: "إعادة الالتقاط",
  confirmProcessDocument: "تأكيد ومعالجة المستند",
  cancel: "إلغاء",
  workspace: "مساحة العمل",
  workspaceSettings: "إعدادات مساحة العمل",
  backToSettings: "الإعدادات",
  imagesOnlyPages: "يمكن إضافة ملفات الصور فقط كصفحات",
  imagesOnlyRetake: "يمكن استخدام ملفات الصور فقط لإعادة التقاط الصفحة",
  addAtLeastOnePage: "أضف صفحة واحدةً على الأقل",
  uploadingPages: "جارٍ رفع الصفحات…",

  statusActive: "نشطة",
  statusClosed: "مغلقة",
  statusArchived: "مؤرشفة",
  statusUploading: "جارٍ الرفع…",
  statusProcessing: "جارٍ المعالجة…",
  statusReady: "جاهز",
  statusFailed: "فشل",
  statusNeedsAttention: "يحتاج إلى انتباه",
  statusThinking: "جارٍ التفكير…",
  statusWorking: "جارٍ العمل…",
  statusWaitingApproval: "بانتظار الموافقة",
  statusComplete: "مكتمل",
  statusCancelled: "ملغى",
  statusIncomplete: "غير مكتمل",

  provenanceConfirmed: "مؤكد",
  provenanceUser: "قدمه المستخدم",
  provenanceDocument: "مستمد من المستند",
  provenanceConversation: "من المحادثة",
  provenanceAi: "مستمد من الذكاء الاصطناعي",
  provenanceSystem: "النظام",

  sourceOfficial: "مصدر رسمي",
  sourceCourt: "محكمة",
  sourceLegislation: "تشريع",
  sourceMatterDocument: "مستند القضية",
  sourceWeb: "بحث على الويب",

  improve: "تحسين",
  makeConcise: "اجعله أكثر إيجازًا",
  moreFormal: "أكثر رسمية",
  addCitations: "إضافة استشهادات",
  checkAgainstMatter: "التحقق مقابل القضية",
  draftAiHint:
    "تبقى متحكمًا بالمستند. تتطلب اقتراحات الذكاء الاصطناعي موافقة عند إنشاء مسودة أو استبدالها.",
  responseDocument: "مستند الرد",

  legalResearch: "البحث القانوني",
  viewAllMatters: "عرض الكل",

  tourRestart: "إعادة البرنامج التعليمي",
  tourRestartHint:
    "أعد جولة مساحة العمل — التنقل في الرئيسية ونصائح الذكاء الاصطناعي للقضية.",
  demoStart: "عرض سير العمل",
  demoPageBody:
    "ينشئ قضية ويضيف وقائع أساسية ويبحث في الدستور المصري ثم يصوغ إنذارًا — داخل شاشات مساحة العمل الحقيقية.",
  demoPreparing: "جارٍ إنشاء القضية التجريبية والوقائع الأساسية…",
  demoFailed: "فشل العرض. حاول مرة أخرى.",
  demoNoWorkspace: "أنشئ مساحة عمل قبل تشغيل العرض.",
  demoMatterTitle: "عرض تجريبي: إنهاء خدمة",
  demoMatterDescription:
    "قضية عرض مباشر: فصل بلا إخطار ومطالبة بدل مهلة لأميرة حسن ضد شركة كايرو تك.",
  demoGuideSetupTitle: "تجهيز العرض",
  demoGuideSetupBody:
    "جارٍ إنشاء قضية توظيف جديدة وحفظ الوقائع الأساسية في ذاكرة القضية.",
  demoGuideOverviewTitle: "نظرة عامة على القضية والوقائع",
  demoGuideOverviewBody:
    "هذه قضية حقيقية. راجع لوحة «سياق القضية» لترى الوقائع المحفوظة — نفس المكان الذي تضيف فيه الوقائع أثناء عملك على أي ملف.",
  demoGuideResearchTitle: "البحث القانوني",
  demoGuideResearchBody:
    "هذه شاشة البحث. طرحنا سؤالًا عن الدستور المصري على المصادر الرسمية — شاهد الإجابة والاستشهادات تظهر هنا.",
  demoGuideDraftTitle: "الصياغة عبر ذكاء القضية",
  demoGuideDraftBody:
    "الذكاء الاصطناعي يصوغ إنذارًا رسميًا اعتمادًا على الوقائع والبحث. تابع التشغيل في هذه الشاشة، ووافق على المسودة عند ظهور طلب الموافقة.",
  demoGuideDoneTitle: "قائمة المسودات",
  demoGuideDoneBody:
    "تظهر مسودات الصياغة هنا للمراجعة. يمكنك فتح أي مسودة أو استكشاف تبويبات القضية. أعد تشغيل العرض من الشريط الجانبي في أي وقت.",
  demoGuideOnMatter: "واجهة القضية الحقيقية",
  demoFactEmployeeKey: "اسم_الموظف",
  demoFactEmployeeValue: "أميرة حسن",
  demoFactEmployerKey: "صاحب_العمل",
  demoFactEmployerValue: "شركة كايرو تك",
  demoFactRoleKey: "المسمى_الوظيفي",
  demoFactRoleValue: "مستشار منتجات",
  demoFactIssueKey: "موضوع_النزاع",
  demoFactIssueValue:
    "أُنهي عقد العمل دون إخطار في ١٥ سبتمبر ٢٠٢٥؛ وتطالب الموظفة ببدل مهلة ٣٠ يومًا.",
  demoFactReliefKey: "الطلبات",
  demoFactReliefValue:
    "صرف بدل المهلة وتأكيد كتابي بأسباب إنهاء الخدمة.",
  demoResearchQuery:
    "ماذا يقول الدستور المصري عن المساواة أمام القانون وحق العمل؟",
  demoDraftTask:
    "باستخدام وقائع القضية الأساسية والمبادئ الدستورية المصرية المتعلقة بالمساواة وحق العمل، صغ إنذارًا رسميًا موجزًا من محامي أميرة حسن موجّهًا إلى شركة كايرو تك، يطلب صرف بدل مهلة ٣٠ يومًا وأسباب إنهاء الخدمة كتابةً. اجعل النص مختصرًا واستشهد بالمبادئ الدستورية ذات الصلة.",
  aiDraftDefaultTitle: "إنذار رسمي",
  articleLabel: "المادة",
  aiStepDraftCreated: 'تم إنشاء المسودة: «{title}»',
  aiStepDrafting: "جارٍ الصياغة…",
  aiStepApprovalRequested: "طُلبت الموافقة",
  aiStepApprovalCreateDraft: "الموافقة على المسودة",
  aiStepApprovalSaveMemory: "حفظ ذاكرة القضية",
  aiStepSearchingCorpus: "جارٍ البحث في المجموعة القانونية…",
  aiStepSearchedCorpus: "تم البحث في المجموعة القانونية",
  aiStepRetrievingProvision: "جارٍ استرجاع الحكم القانوني…",
  aiStepRetrievedProvision: "تم استرجاع الحكم القانوني",
  aiStepSearchingWeb: "جارٍ البحث على الويب…",
  aiStepSearchedWeb: "تم البحث على الويب",
  aiStepBuildContext: "تم بناء السياق القانوني",
  aiStepValidateCitations: "تم التحقق من الاستشهادات",
  aiStepConversationContext: "تم فهم سياق المحادثة",
  aiStepReviewedFindings: "تمت مراجعة النتائج",
  aiStepValidateEvidence: "تم التحقق من الأدلة",
  aiStepRetrievedTarget: "تم استرجاع الحكم المستهدف",
  aiStepResearchTarget: "تم تحديد هدف البحث",
  aiStepRetryRetrieval: "إعادة محاولة الاسترجاع المستهدف",
  tourSkip: "تخطّي",
  tourBack: "رجوع",
  tourNext: "التالي",
  tourDone: "تم",
  tourProgress: "الخطوة {current} من {total}",
  tourWelcomeTitle: "مرحبًا بك في المنصة القانونية",
  tourWelcomeBody:
    "جولة سريعة في مساحة العمل — التنقل والقضايا وأين يساعد الذكاء الاصطناعي. تستغرق حوالي دقيقة.",
  tourSidebarTitle: "قائمة التنقل",
  tourSidebarBody:
    "انتقل بين الرئيسية والقضايا والعملاء والمستندات والإعدادات من الشريط الجانبي. يمكنك طيه في أي وقت.",
  tourNewMatterTitle: "ابدأ قضية جديدة",
  tourNewMatterBody:
    "أنشئ قضية لتجميع المستندات والبحوث والمسودات ومحادثات الذكاء الاصطناعي لملف واحد.",
  tourRecentMattersTitle: "قضاياك الأخيرة",
  tourRecentMattersBody:
    "افتح قضية لمراجعة النظرة العامة، أو اختر اسأل الذكاء الاصطناعي للعمل مع المساعد على هذه القضية.",
  tourShortcutsTitle: "المستندات والبحث والإعدادات",
  tourShortcutsBody:
    "تصفح مستندات القضايا، أو نفّذ بحثًا قانونيًا عامًا، أو أدِر مساحات العمل وإعدادات الحساب من هذه الاختصارات.",
  tourCommandTitle: "لوحة الأوامر",
  tourCommandBody:
    "اضغط ⌘K (أو Ctrl+K) في أي مكان للبحث في القضايا والانتقال إلى الإجراءات الشائعة.",
  tourShellDoneTitle: "أنت جاهز",
  tourShellDoneBody:
    "افتح قضية وانتقل إلى تبويب الذكاء الاصطناعي للجولة التالية. يمكنك إعادة هذه الجولة من الشريط الجانبي في أي وقت.",
  tourMatterTabsTitle: "أقسام القضية",
  tourMatterTabsBody:
    "لكل قضية نظرة عامة وذكاء اصطناعي ومستندات وبحث ومسودات ونشاط — بدّل التبويبات حسب سير العمل.",
  tourAiActionsTitle: "إجراءات سريعة بالذكاء الاصطناعي",
  tourAiActionsBody:
    "ابدأ بمهمة مقترحة — بحث أو صياغة أو مراجعة — أو اكتب طلبك أدناه.",
  tourAiComposerTitle: "اسأل عن هذه القضية",
  tourAiComposerBody:
    "صف ما تحتاجه. يستخدم المساعد سياق القضية ومستنداتها، وقد يطلب موافقة قبل الإجراءات الحساسة.",
  tourMatterContextTitle: "سياق القضية",
  tourMatterContextBodyTour:
    "الحقائق والذاكرة وعدادات المستندات هنا حتى يبقى الذكاء الاصطناعي مرتبطًا بما تعرفه عن القضية.",
  tourAiDoneTitle: "ابدأ العمل",
  tourAiDoneBody:
    "جرّب سؤالًا أو إجراءً سريعًا. تُفتح الاستشهادات والأدلة في درج جانبي عندما يشير المساعد إلى المصادر.",
};

export const MESSAGES: Record<Locale, Messages> = { en, fr, ar };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale] ?? en;
}
