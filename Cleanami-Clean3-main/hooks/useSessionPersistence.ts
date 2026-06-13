"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { SignupFormData, PriceDetails } from "@/lib/validations/bookng-modal";
import {
  createSession,
  loadSession,
  saveSessionProgress,
  clearSession,
  SessionResponse,
} from "@/lib/actions/session.actions";
import { isServiceUnavailableMessage } from "@/lib/env/messages";

interface UseSessionPersistenceOptions {
  /** Debounce delay for autosave in ms */
  debounceMs?: number;
  /** Callback when session is loaded with existing data */
  onSessionLoaded?: (data: {
    formData: Partial<SignupFormData>;
    currentStep: number;
    priceDetails: PriceDetails | null;
  }) => void;
}

interface UseSessionPersistenceReturn {
  /** Whether we're checking for an existing session */
  isLoadingSession: boolean;
  /** Whether an existing session was found */
  hasExistingSession: boolean;
  /** The existing session data (if found) */
  existingSessionData: SessionResponse | null;
  /** Accept and load the existing session */
  acceptExistingSession: () => void;
  /** Decline and start fresh */
  startFreshSession: () => Promise<void>;
  /** Save current progress (debounced) */
  saveProgress: (
    formData: Partial<SignupFormData>,
    currentStep: number,
    priceDetails: PriceDetails | null
  ) => void;
  /** Force save immediately (non-debounced) */
  saveProgressNow: (
    formData: Partial<SignupFormData>,
    currentStep: number,
    priceDetails: PriceDetails | null
  ) => Promise<void>;
  /** Session ID for resume links */
  sessionId: string | null;
}

export function useSessionPersistence(
  options: UseSessionPersistenceOptions = {}
): UseSessionPersistenceReturn {
  const { debounceMs = 1000, onSessionLoaded } = options;

  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [hasExistingSession, setHasExistingSession] = useState(false);
  const [existingSessionData, setExistingSessionData] = useState<SessionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const onSessionLoadedRef = useRef(onSessionLoaded);

  // Keep callback ref updated
  useEffect(() => {
    onSessionLoadedRef.current = onSessionLoaded;
  }, [onSessionLoaded]);

  const notifyIfUnavailable = useCallback((error?: string) => {
    if (error && isServiceUnavailableMessage(error)) {
      toast.error(error);
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function checkSession() {
      setIsLoadingSession(true);
      const result = await loadSession();

      if (result.success) {
        setHasExistingSession(true);
        setExistingSessionData(result);
        setSessionId(result.sessionId);
      } else {
        // No existing session - create a new one
        const newSession = await createSession();
        if (newSession.success) {
          setSessionId(newSession.sessionId);
        } else {
          notifyIfUnavailable(newSession.error);
        }
      }

      setIsLoadingSession(false);
    }

    checkSession();
  }, []);

  // Accept the existing session and load its data
  const acceptExistingSession = useCallback(() => {
    if (existingSessionData?.success) {
      onSessionLoadedRef.current?.({
        formData: existingSessionData.formData,
        currentStep: existingSessionData.currentStep,
        priceDetails: existingSessionData.priceDetails,
      });
      setHasExistingSession(false); // Dismiss the prompt
    }
  }, [existingSessionData]);

  // Clear and start fresh
  const startFreshSession = useCallback(async () => {
    await clearSession();
    const newSession = await createSession();
    if (newSession.success) {
      setSessionId(newSession.sessionId);
    } else {
      notifyIfUnavailable(newSession.error);
    }
    setHasExistingSession(false);
    setExistingSessionData(null);
  }, [notifyIfUnavailable]);

  // Debounced save
  const saveProgress = useCallback(
    (
      formData: Partial<SignupFormData>,
      currentStep: number,
      priceDetails: PriceDetails | null
    ) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        const result = await saveSessionProgress(formData, currentStep, priceDetails);
        notifyIfUnavailable(result.error);
      }, debounceMs);
    },
    [debounceMs, notifyIfUnavailable]
  );

  // Immediate save (for step changes)
  const saveProgressNow = useCallback(
    async (
      formData: Partial<SignupFormData>,
      currentStep: number,
      priceDetails: PriceDetails | null
    ) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const result = await saveSessionProgress(formData, currentStep, priceDetails);
      notifyIfUnavailable(result.error);
    },
    [notifyIfUnavailable]
  );

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    isLoadingSession,
    hasExistingSession,
    existingSessionData,
    acceptExistingSession,
    startFreshSession,
    saveProgress,
    saveProgressNow,
    sessionId,
  };
}