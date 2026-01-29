import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { SubscriptionExpiredModal } from "@/components/SubscriptionExpiredModal";
import { SubscriptionExpiredError } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { isFreemiumRoute, isProtectedRoute } from "@/hooks/useAccessControl";

interface SubscriptionContextType {
  showExpiredModal: (daysExpired?: number) => void;
  hideExpiredModal: () => void;
  handleSubscriptionError: (error: unknown) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [daysExpired, setDaysExpired] = useState(0);
  const [location] = useLocation();

  const showExpiredModal = useCallback((days: number = 0) => {
    setDaysExpired(days);
    setIsModalOpen(true);
  }, []);

  const hideExpiredModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSubscriptionError = useCallback((error: unknown): boolean => {
    if (error instanceof SubscriptionExpiredError) {
      showExpiredModal(error.daysExpired);
      return true;
    }
    return false;
  }, [showExpiredModal]);

  useEffect(() => {
    if (isFreemiumRoute(location)) {
      setIsModalOpen(false);
    }
  }, [location]);

  return (
    <SubscriptionContext.Provider value={{ showExpiredModal, hideExpiredModal, handleSubscriptionError }}>
      {children}
      <SubscriptionExpiredModal 
        isOpen={isModalOpen}
        onClose={hideExpiredModal}
        daysExpired={daysExpired}
      />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
