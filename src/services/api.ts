import { isSupabaseConfigured } from "./supabase/client";
import * as local from "./localApi";
import * as remote from "./supabaseApi";

/**
 * Single data access point for the UI.
 *
 * With `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set, every call goes to
 * Supabase (real accounts, shared posts, file storage). Without them the app
 * falls back to the in-browser store so it still runs with no setup.
 */

type Backend = Omit<typeof local, "DEMO_ACCOUNT">;

const backend: Backend = isSupabaseConfigured ? remote : local;

/** True while data lives only in this browser. */
export const isLocalMode = !isSupabaseConfigured;

export const DEMO_ACCOUNT = local.DEMO_ACCOUNT;

export const {
  getCurrentUser,
  signUp,
  signIn,
  signOut,
  resendConfirmation,
  updateProfile,
  changePassword,
  deleteAccount,
  getFeed,
  getPost,
  createPost,
  updatePost,
  deletePost,
  reactToPost,
  ratePost,
  toggleSavePost,
  getComments,
  addComment,
  deleteComment,
  getProfile,
  searchSuggestions,
  getTrending,
  getAttachmentUrl,
  subscribeToAuth,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getMyVerification,
  requestVerification,
  getVerificationRequests,
  decideVerification,
  uploadProfileImage,
  getConversations,
  getThread,
  sendMessage,
  editMessage,
  unsendMessage,
  reactToMessage,
  joinConversation,
  markConversationRead,
  getUnreadCount,
  subscribeToChat,
  getCurriculumSubjects,
  getCurriculumChapters,
  getQuestions,
  getQuestion,
  saveQuestion,
  deleteQuestion,
  uploadQuestionImage,
  getExamPapers,
  getExamPaper,
  startExam,
  saveExamAnswer,
  submitExam,
  getExamAttempt,
  getMyExamAttempts,
  recordPracticeAnswer,
  getMistakes,
  deleteMistake,
  getDailyQuestion,
  getDailyStreak,
  getChapterProgress,
  getStudyPlan,
  saveStudyPlan,
  deleteStudyPlan,
  getVideoChannels,
  saveVideoChannel,
  deleteVideoChannel,
  getVideoQuizzes,
  saveVideoQuiz,
  deleteVideoQuiz,
  getVideoProgress,
  setVideoProgress,
  deleteVideoProgress,
  getLiveQuizzes,
  getLiveQuiz,
  saveLiveQuiz,
  deleteLiveQuiz,
  startLiveGame,
  joinLiveGame,
  getLiveGame,
  liveNext,
  liveReveal,
  liveFinish,
  answerLive,
  subscribeLiveGame,
  getConceptLinks,
  getResourceTopics,
  linkResourceTopic,
  unlinkResourceTopic,
  getLearningEvents,
} = backend;

export type { TrendingView, VerificationState } from "./localApi";
