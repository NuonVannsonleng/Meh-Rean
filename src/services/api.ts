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
  unsendMessage,
  markConversationRead,
  getUnreadCount,
  subscribeToChat,
} = backend;

export type { TrendingView, VerificationState } from "./localApi";
